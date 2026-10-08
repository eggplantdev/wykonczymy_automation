import { sql } from '@payloadcms/db-vercel-postgres'
import type { ExpenseDocT } from '@/lib/expense-duplicates/match'
import type { DbExecutorT } from './get-db'
import { expenseDraftReadRowSchema, type ExpenseDraftReadRowT } from './expense-draft-read'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'
import { normalizedNumber, noteLine1 } from './document-number-sql'
import { MEDIA_JSON, transactionInvoicesJson } from './media-json'
import { inList, type SqlT } from './sql-list'
import type { PreviewFileT } from '@/types/media'

// The types a receipt gets booked under — Orlen 614,42 zł went in three times as OTHER.
const RECEIPT_TYPES = sql`('INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'OTHER')`

type DraftProbeT = ExpenseDocT & { mediaIds: number[] }

export type CandidateT = ExpenseDocT & {
  // A pending zgłoszenie can match through several of its paragony, so `id` alone repeats.
  key: string
  source: 'transaction' | 'draft'
  id: number
  date: string
  submitterName: string | null
  investmentName: string | null
  pages: PreviewFileT[]
}

type CandidateFilterT = { amountsCents: number[]; documentNumbers: string[] }

const toPages = (value: unknown): PreviewFileT[] =>
  Array.isArray(value) ? (value as PreviewFileT[]) : []

const docOfReadRow = (row: ExpenseDraftReadRowT): ExpenseDocT => ({
  amount: row.amount ?? null,
  documentNumber: row.documentNumber || null,
  sellerNip: row.sellerNip || null,
  documentDate: row.documentDate || null,
  invoiceNote: row.invoiceNote ?? null,
  description: row.description ?? null,
})

const amountOrNumber = (amount: SqlT, numbers: SqlT[], filter: CandidateFilterT) =>
  sql`(${sql.join(
    [
      inList(sql`round(${amount} * 100)::bigint`, filter.amountsCents),
      ...numbers.map((number) => inList(normalizedNumber(number), filter.documentNumbers)),
    ].map((clause) => clause ?? sql`false`),
    sql.raw(' OR '),
  )})`

export async function loadDraftProbes(db: DbExecutorT, draftId: number): Promise<DraftProbeT[]> {
  const res = await db.execute(sql`
    SELECT r.value AS read_row
    FROM worker_expense_drafts d
    CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') WITH ORDINALITY r(value, ordinality)
    WHERE d.id = ${draftId} AND d.status = 'pending'
    ORDER BY r.ordinality
  `)
  return res.rows.flatMap((row) => {
    const read = expenseDraftReadRowSchema.safeParse(row.read_row)
    if (!read.success) return []
    return [{ mediaIds: read.data.mediaIds, ...docOfReadRow(read.data) }]
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
      ${transactionInvoicesJson(sql`t.id`)} AS pages
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
    key: `transaction-${row.id}`,
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
      SELECT d.id, d.sent_at, d.worker_id, d.investment_id, r.value AS read_row, r.ordinality
      FROM worker_expense_drafts d
      CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') WITH ORDINALITY r(value, ordinality)
      WHERE d.status = 'pending' AND d.id <> ${excludeDraftId}
    )
    SELECT rr.id, rr.sent_at, rr.read_row, rr.ordinality, w.name AS submitter_name, i.name AS investment_name,
      COALESCE((SELECT json_agg(${MEDIA_JSON})
        FROM media m
        WHERE m.id IN (SELECT jsonb_array_elements_text(rr.read_row -> 'mediaIds')::int)
          AND m.url IS NOT NULL),
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
        key: `draft-${row.id}-${row.ordinality}`,
        source: 'draft' as const,
        id: Number(row.id),
        date: isoOrNull(row.sent_at) ?? '',
        submitterName: textOrNull(row.submitter_name),
        investmentName: textOrNull(row.investment_name),
        ...docOfReadRow(read.data),
        pages: toPages(row.pages),
      },
    ]
  })
}
