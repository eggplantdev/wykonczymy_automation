import { sql } from '@payloadcms/db-vercel-postgres'
import { RECEIPT_TYPES } from '@/lib/expense-duplicates/constants'
import { cents, documentNumberOf, type ExpenseDocT } from '@/lib/expense-duplicates/match'
import type { CandidateT } from '@/lib/expense-duplicates/types'
import type { DbExecutorT } from './get-db'
import { expenseDraftReadRowSchema, type ExpenseDraftReadRowT } from './expense-draft-read'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'
import { normalizedNumber, noteLine1 } from './document-number-sql'
import { MEDIA_JSON, transactionInvoicesJson } from './media-json'
import { decidedReadRows } from './worker-expense-drafts'
import { inList, type SqlT } from './sql-list'
import type { PreviewFileT } from '@/types/media'

const IS_RECEIPT = inList(sql`t.type`, RECEIPT_TYPES)

type MatchFilterT = { amountsCents: number[]; documentNumbers: string[] }

/** What could match the probes — each value bound once, however many probes share it. */
export const matchFilterOf = (probes: ExpenseDocT[]): MatchFilterT => ({
  amountsCents: [...new Set(probes.flatMap((probe) => cents(probe.amount) ?? []))],
  documentNumbers: [...new Set(probes.flatMap((probe) => documentNumberOf(probe) ?? []))],
})

// The finder probes the transakcje its scope resolved to; everyone else loads by what could match.
export type TransactionSelectorT = MatchFilterT | { transactionIds: number[] }

const toReadRows = (value: unknown): number[] => (Array.isArray(value) ? value.map(Number) : [])

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

const amountOrNumber = (amount: SqlT, numbers: SqlT[], filter: MatchFilterT) =>
  sql`(${sql.join(
    [
      inList(sql`round(${amount} * 100)::bigint`, filter.amountsCents),
      ...numbers.map((number) => inList(normalizedNumber(number), filter.documentNumbers)),
    ].map((clause) => clause ?? sql`false`),
    sql.raw(' OR '),
  )})`

const readRowMatches = (readRow: SqlT, filter: MatchFilterT) =>
  amountOrNumber(
    sql`(${readRow} ->> 'amount')::numeric`,
    [sql`(${readRow} ->> 'documentNumber')`, noteLine1(sql`(${readRow} ->> 'invoiceNote')`)],
    filter,
  )

const selected = (selector: TransactionSelectorT, matches: (filter: MatchFilterT) => SqlT) =>
  'transactionIds' in selector
    ? (inList(sql`t.id`, selector.transactionIds) ?? sql`false`)
    : matches(selector)

export async function loadTransactionCandidates(
  db: DbExecutorT,
  selector: TransactionSelectorT,
): Promise<CandidateT[]> {
  const [own, merged] = await Promise.all([
    loadBookedTransactions(db, selector),
    loadMergedParagony(db, selector),
  ])
  return [...own, ...merged]
}

async function loadBookedTransactions(
  db: DbExecutorT,
  selector: TransactionSelectorT,
): Promise<CandidateT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.amount, t.date, t.description, t.invoice_note, t.document_number, t.seller_nip,
      t.document_date, t.investment_id, i.name AS investment_name, dt.draft_id, dt.read_rows,
      COALESCE(drafter.name, creator.name) AS submitter_name,
      ${transactionInvoicesJson(sql`t.id`)} AS pages
    FROM transactions t
    LEFT JOIN investments i ON i.id = t.investment_id
    LEFT JOIN users creator ON creator.id = t.created_by_id
    LEFT JOIN worker_expense_draft_transfers dt ON dt.transfer_id = t.id
    LEFT JOIN worker_expense_drafts src ON src.id = dt.draft_id
    LEFT JOIN users drafter ON drafter.id = src.worker_id
    WHERE ${IS_RECEIPT} AND t.cancelled IS NOT TRUE
      AND ${selected(selector, (filter) => amountOrNumber(sql`t.amount`, [sql`t.document_number`, noteLine1(sql`t.invoice_note`)], filter))}
  `)
  return res.rows.map((row) => ({
    key: `transaction-${row.id}`,
    source: 'transaction',
    id: Number(row.id),
    draftId: numOrNull(row.draft_id),
    readRows: toReadRows(row.read_rows),
    date: text(row.date),
    investmentId: numOrNull(row.investment_id),
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

// A transakcja booked from merged paragony carries their summed Kwota, which matches none of them —
// so each paragon behind it is a candidate of its own, read off the zgłoszenie it came from.
async function loadMergedParagony(
  db: DbExecutorT,
  selector: TransactionSelectorT,
): Promise<CandidateT[]> {
  const res = await db.execute(sql`
    WITH paragony AS (
      SELECT dt.transfer_id, dt.draft_id, dt.read_rows, src.worker_id,
        src.ai_read -> 'rows' -> rr.read_row AS read_row, rr.read_row AS position
      FROM worker_expense_draft_transfers dt
      JOIN worker_expense_drafts src ON src.id = dt.draft_id
      CROSS JOIN LATERAL unnest(dt.read_rows) rr(read_row)
      WHERE cardinality(dt.read_rows) > 1
    )
    SELECT t.id, t.date, t.investment_id, p.draft_id, p.read_rows, p.read_row, p.position,
      i.name AS investment_name, w.name AS submitter_name, ${transactionInvoicesJson(sql`t.id`)} AS pages
    FROM paragony p
    JOIN transactions t ON t.id = p.transfer_id
    LEFT JOIN investments i ON i.id = t.investment_id
    LEFT JOIN users w ON w.id = p.worker_id
    WHERE ${IS_RECEIPT} AND t.cancelled IS NOT TRUE
      AND ${selected(selector, (filter) => readRowMatches(sql`p.read_row`, filter))}
  `)
  return res.rows.flatMap((row) => {
    const read = expenseDraftReadRowSchema.safeParse(row.read_row)
    if (!read.success) return []
    return [
      {
        key: `transaction-${row.id}-${row.position}`,
        source: 'transaction' as const,
        id: Number(row.id),
        draftId: numOrNull(row.draft_id),
        readRows: toReadRows(row.read_rows),
        date: text(row.date),
        investmentId: numOrNull(row.investment_id),
        submitterName: textOrNull(row.submitter_name),
        investmentName: textOrNull(row.investment_name),
        ...docOfReadRow(read.data),
        pages: toPages(row.pages),
      },
    ]
  })
}

type DraftReadSelectorT = { filter?: MatchFilterT; draftId?: number }

/** The undecided read rows of pending zgłoszenia — every one, one zgłoszenie's, or those that could match. */
export async function loadDraftCandidates(
  db: DbExecutorT,
  { filter, draftId }: DraftReadSelectorT = {},
): Promise<CandidateT[]> {
  const res = await db.execute(sql`
    WITH read_rows AS (
      SELECT d.id, d.sent_at, d.worker_id, d.investment_id, r.value AS read_row, r.ordinality
      FROM worker_expense_drafts d
      CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') WITH ORDINALITY r(value, ordinality)
      WHERE d.status = 'pending' ${draftId === undefined ? sql`` : sql`AND d.id = ${draftId}`}
    )
    SELECT rr.id, rr.sent_at, rr.investment_id, rr.read_row, rr.ordinality,
      w.name AS submitter_name, i.name AS investment_name,
      COALESCE((SELECT json_agg(${MEDIA_JSON})
        FROM media m
        WHERE m.id IN (SELECT jsonb_array_elements_text(rr.read_row -> 'mediaIds')::int)
          AND m.url IS NOT NULL),
        '[]'::json) AS pages
    FROM read_rows rr
    JOIN users w ON w.id = rr.worker_id
    LEFT JOIN investments i ON i.id = rr.investment_id
    -- Probing a decided read row would only match the transakcja booked from it.
    WHERE rr.ordinality - 1 NOT IN (${decidedReadRows(sql`rr.id`)})
      ${filter ? sql`AND ${readRowMatches(sql`rr.read_row`, filter)}` : sql``}
    ORDER BY rr.id, rr.ordinality
  `)
  return res.rows.flatMap((row) => {
    const read = expenseDraftReadRowSchema.safeParse(row.read_row)
    if (!read.success) return []
    const readRow = Number(row.ordinality) - 1
    return [
      {
        key: `draft-${row.id}-${row.ordinality}`,
        source: 'draft' as const,
        id: Number(row.id),
        draftId: Number(row.id),
        readRows: [readRow],
        date: isoOrNull(row.sent_at) ?? '',
        investmentId: numOrNull(row.investment_id),
        submitterName: textOrNull(row.submitter_name),
        investmentName: textOrNull(row.investment_name),
        ...docOfReadRow(read.data),
        pages: toPages(row.pages),
      },
    ]
  })
}
