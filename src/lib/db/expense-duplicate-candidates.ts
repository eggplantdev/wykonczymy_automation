import { sql } from '@payloadcms/db-vercel-postgres'
import type { ExpenseDocT } from '@/lib/expense-duplicates/match'
import type { DbExecutorT } from './get-db'
import { expenseDraftReadRowSchema, type ExpenseDraftReadRowT } from './expense-draft-read'
import { numOrNull, text, textOrNull } from './row-coerce'
import { sqlList, type SqlT } from './sql-list'

// The types a receipt gets booked under — Orlen 614,42 zł went in three times as OTHER.
const RECEIPT_TYPES = sql`('INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'OTHER')`

const PAGE_JSON = sql`json_build_object('url', m.url, 'filename', m.filename, 'mimeType', m.mime_type)`

// The SQL twin of `normalizeDocumentNumber`, close enough to pre-filter; the matcher decides.
const normalizedNumber = (value: SqlT) => sql`upper(regexp_replace(${value}, '\\s', '', 'g'))`
const noteLine1 = (note: SqlT) => sql`split_part(btrim(${note}, E' \\n\\r\\t'), E'\\n', 1)`

export type PageT = { url: string; filename: string; mimeType: string }

export type DraftProbeT = ExpenseDocT & { rowIndex: number; mediaIds: number[] }

export type CandidateT = ExpenseDocT & {
  source: 'transaction' | 'draft'
  id: number
  date: string
  submitterName: string | null
  investmentName: string | null
  pages: PageT[]
}

export type CandidateFilterT = { amountsCents: number[]; documentNumbers: string[] }

const toPages = (value: unknown): PageT[] => (Array.isArray(value) ? (value as PageT[]) : [])

const docOfReadRow = (row: ExpenseDraftReadRowT): ExpenseDocT => ({
  amount: row.amount ?? null,
  documentNumber: row.documentNumber || null,
  sellerNip: row.sellerNip || null,
  documentDate: row.documentDate || null,
  invoiceNote: row.invoiceNote ?? null,
  description: row.description ?? null,
})

const amountOrNumber = (amount: SqlT, numbers: SqlT[], filter: CandidateFilterT) => {
  const clauses = [
    ...(filter.amountsCents.length > 0
      ? [sql`round(${amount} * 100)::bigint IN (${sqlList(filter.amountsCents)})`]
      : []),
    ...(filter.documentNumbers.length > 0
      ? numbers.map(
          (number) => sql`${normalizedNumber(number)} IN (${sqlList(filter.documentNumbers)})`,
        )
      : []),
  ]
  return clauses.length > 0 ? sql`(${sql.join(clauses, sql.raw(' OR '))})` : sql`false`
}

export async function loadDraftProbes(db: DbExecutorT, draftId: number): Promise<DraftProbeT[]> {
  const res = await db.execute(sql`
    SELECT r.ordinality - 1 AS row_index, r.value AS read_row
    FROM worker_expense_drafts d
    CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') WITH ORDINALITY r(value, ordinality)
    WHERE d.id = ${draftId} AND d.status = 'pending'
    ORDER BY r.ordinality
  `)
  return res.rows.flatMap((row) => {
    const read = expenseDraftReadRowSchema.safeParse(row.read_row)
    if (!read.success) return []
    return [
      { rowIndex: Number(row.row_index), mediaIds: read.data.mediaIds, ...docOfReadRow(read.data) },
    ]
  })
}

export async function loadTransactionCandidates(
  db: DbExecutorT,
  filter: CandidateFilterT,
): Promise<CandidateT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.amount, t.date, t.description, t.invoice_note, t.document_number, t.seller_nip,
      t.document_date, i.name AS investment_name,
      COALESCE(drafter.name, creator.name) AS submitter_name,
      COALESCE((SELECT json_agg(${PAGE_JSON} ORDER BY r."order")
        FROM transactions_rels r JOIN media m ON m.id = r.media_id
        WHERE r.parent_id = t.id), '[]'::json) AS pages
    FROM transactions t
    LEFT JOIN investments i ON i.id = t.investment_id
    LEFT JOIN users creator ON creator.id = t.created_by_id
    LEFT JOIN worker_expense_draft_transfers dt ON dt.transfer_id = t.id
    LEFT JOIN worker_expense_drafts src ON src.id = dt.draft_id
    LEFT JOIN users drafter ON drafter.id = src.worker_id
    WHERE t.type IN ${RECEIPT_TYPES} AND t.cancelled IS NOT TRUE
      AND ${amountOrNumber(sql`t.amount`, [sql`t.document_number`, noteLine1(sql`t.invoice_note`)], filter)}
  `)
  return res.rows.map((row) => ({
    source: 'transaction',
    id: Number(row.id),
    date: text(row.date),
    submitterName: textOrNull(row.submitter_name),
    investmentName: textOrNull(row.investment_name),
    amount: numOrNull(row.amount),
    documentNumber: textOrNull(row.document_number),
    sellerNip: textOrNull(row.seller_nip),
    documentDate: textOrNull(row.document_date),
    invoiceNote: textOrNull(row.invoice_note),
    description: textOrNull(row.description),
    pages: toPages(row.pages),
  }))
}

export async function loadDraftCandidates(
  db: DbExecutorT,
  { excludeDraftId, ...filter }: CandidateFilterT & { excludeDraftId: number },
): Promise<CandidateT[]> {
  const res = await db.execute(sql`
    WITH read_rows AS (
      SELECT d.id, d.sent_at, d.worker_id, d.investment_id, r.value AS read_row
      FROM worker_expense_drafts d
      CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') r
      WHERE d.status = 'pending' AND d.id <> ${excludeDraftId}
    )
    SELECT rr.id, rr.sent_at, rr.read_row, w.name AS submitter_name, i.name AS investment_name,
      COALESCE((SELECT json_agg(${PAGE_JSON})
        FROM media m
        WHERE m.id IN (SELECT jsonb_array_elements_text(rr.read_row -> 'mediaIds')::int)),
        '[]'::json) AS pages
    FROM read_rows rr
    JOIN users w ON w.id = rr.worker_id
    LEFT JOIN investments i ON i.id = rr.investment_id
    WHERE ${amountOrNumber(
      sql`(rr.read_row ->> 'amount')::numeric`,
      [sql`(rr.read_row ->> 'documentNumber')`, noteLine1(sql`(rr.read_row ->> 'invoiceNote')`)],
      filter,
    )}
  `)
  return res.rows.flatMap((row) => {
    const read = expenseDraftReadRowSchema.safeParse(row.read_row)
    if (!read.success) return []
    return [
      {
        source: 'draft' as const,
        id: Number(row.id),
        date: text(row.sent_at),
        submitterName: textOrNull(row.submitter_name),
        investmentName: textOrNull(row.investment_name),
        ...docOfReadRow(read.data),
        pages: toPages(row.pages),
      },
    ]
  })
}
