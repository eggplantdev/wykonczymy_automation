// SPIKE (EX-1025): candidates a zgłoszenie's paragony are compared against.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { ExpenseDocT } from '@/lib/expense-duplicates/match'
import type { DbExecutorT } from './get-db'
import { expenseDraftReadSchema } from './expense-draft-read'
import { numOrNull, text, textOrNull } from './row-coerce'
import { sqlList } from './sql-list'

// The types a receipt gets booked under — Orlen 614,42 zł went in three times as OTHER.
const RECEIPT_TYPES = sql`('INVESTMENT_EXPENSE', 'INVESTMENT_EXPENSE_NET', 'OTHER')`

const FINGERPRINT = sql`concat(m.filesize, ':', m.width, 'x', m.height)`

export type DraftProbeT = ExpenseDocT & { rowIndex: number; mediaIds: number[] }

export type CandidateT = ExpenseDocT & {
  source: 'transaction' | 'draft'
  id: number
  date: string
  who: string | null
  investmentName: string | null
  pages: { url: string; filename: string; mimeType: string }[]
}

type PageRowT = { url: string; filename: string; mimeType: string; fingerprint: string }

const PAGES_JSON = sql`json_build_object(
  'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type, 'fingerprint', ${FINGERPRINT}
)`

const toPages = (value: unknown): PageRowT[] => (Array.isArray(value) ? (value as PageRowT[]) : [])

export async function loadDraftProbes(db: DbExecutorT, draftId: number): Promise<DraftProbeT[]> {
  const res = await db.execute(sql`
    SELECT d.ai_read,
      COALESCE((SELECT json_object_agg(m.id, ${FINGERPRINT})
        FROM worker_expense_draft_media dm JOIN media m ON m.id = dm.media_id
        WHERE dm.draft_id = d.id), '{}'::json) AS fingerprints,
      COALESCE((SELECT array_agg(media_id)
        FROM worker_expense_draft_skipped_receipts sr, unnest(sr.media_ids) media_id
        WHERE sr.draft_id = d.id), '{}') AS skipped_media_ids
    FROM worker_expense_drafts d
    WHERE d.id = ${draftId}
  `)
  const row = res.rows[0]
  const read = expenseDraftReadSchema.safeParse(row?.ai_read)
  if (!row || !read.success) return []
  const fingerprintOf = row.fingerprints as Record<string, string>
  const skipped = new Set((row.skipped_media_ids as unknown[]).map(Number))

  // A paragon already refused as a duplicate has been decided; `rowIndex` stays the read's position.
  return read.data.rows.flatMap((readRow, rowIndex) =>
    readRow.mediaIds.every((id) => skipped.has(id))
      ? []
      : [
          {
            rowIndex,
            mediaIds: readRow.mediaIds,
            amount: readRow.amount ?? null,
            invoiceNote: readRow.invoiceNote ?? null,
            description: readRow.description ?? null,
            fingerprints: readRow.mediaIds.map((id) => fingerprintOf[id]).filter(Boolean),
          },
        ],
  )
}

/**
 * Pre-filters in SQL on what every strong match needs (an equal amount, or a shared file / number
 * when the read has no amount); `matchExpense` makes the actual call.
 */
export async function loadDuplicateCandidates(
  db: DbExecutorT,
  draftId: number,
  probes: DraftProbeT[],
): Promise<CandidateT[]> {
  const amountCents = probes.flatMap((p) => (p.amount === null ? [] : [Math.round(p.amount * 100)]))
  const fingerprints = probes.flatMap((p) => p.fingerprints)
  if (amountCents.length === 0 && fingerprints.length === 0) return []

  const amountFilter =
    amountCents.length > 0
      ? sql`round(t.amount * 100)::bigint IN (${sqlList(amountCents)})`
      : sql`false`
  const fileFilter =
    fingerprints.length > 0
      ? sql`EXISTS (SELECT 1 FROM transactions_rels r JOIN media m ON m.id = r.media_id
          WHERE r.parent_id = t.id AND ${FINGERPRINT} IN (${sqlList(fingerprints)}))`
      : sql`false`

  const [transactions, drafts] = await Promise.all([
    db.execute(sql`
      SELECT t.id, t.amount, t.date, t.description, t.invoice_note, i.name AS investment_name,
        COALESCE(drafter.name, creator.name) AS who,
        COALESCE((SELECT json_agg(${PAGES_JSON} ORDER BY r."order")
          FROM transactions_rels r JOIN media m ON m.id = r.media_id
          WHERE r.parent_id = t.id), '[]'::json) AS pages
      FROM transactions t
      LEFT JOIN investments i ON i.id = t.investment_id
      LEFT JOIN users creator ON creator.id = t.created_by_id
      LEFT JOIN worker_expense_draft_transfers dt ON dt.transfer_id = t.id
      LEFT JOIN worker_expense_drafts src ON src.id = dt.draft_id
      LEFT JOIN users drafter ON drafter.id = src.worker_id
      WHERE t.type IN ${RECEIPT_TYPES} AND NOT COALESCE(t.cancelled, false)
        AND (${amountFilter} OR ${fileFilter})
    `),
    db.execute(sql`
      SELECT d.id, d.sent_at, w.name AS who, i.name AS investment_name, r.value AS read_row,
        COALESCE((SELECT json_agg(${PAGES_JSON})
          FROM media m
          WHERE m.id IN (SELECT jsonb_array_elements_text(r.value -> 'mediaIds')::int)), '[]'::json) AS pages
      FROM worker_expense_drafts d
      CROSS JOIN LATERAL jsonb_array_elements(d.ai_read -> 'rows') r
      JOIN users w ON w.id = d.worker_id
      JOIN investments i ON i.id = d.investment_id
      WHERE d.status = 'pending' AND d.id <> ${draftId}
        AND NOT EXISTS (SELECT 1 FROM worker_expense_draft_skipped_receipts sr
          WHERE sr.draft_id = d.id
            AND sr.media_ids @> ARRAY(SELECT jsonb_array_elements_text(r.value -> 'mediaIds')::int))
    `),
  ])

  const fromTransactions = transactions.rows.map((row): CandidateT => {
    const pages = toPages(row.pages)
    return {
      source: 'transaction',
      id: Number(row.id),
      date: text(row.date),
      who: textOrNull(row.who),
      investmentName: textOrNull(row.investment_name),
      amount: numOrNull(row.amount),
      invoiceNote: textOrNull(row.invoice_note),
      description: textOrNull(row.description),
      fingerprints: pages.map((page) => page.fingerprint),
      pages,
    }
  })

  const fromDrafts = drafts.rows.map((row): CandidateT => {
    const pages = toPages(row.pages)
    const readRow = row.read_row as { amount?: number; invoiceNote?: string; description?: string }
    return {
      source: 'draft',
      id: Number(row.id),
      date: text(row.sent_at),
      who: textOrNull(row.who),
      investmentName: textOrNull(row.investment_name),
      amount: readRow.amount ?? null,
      invoiceNote: readRow.invoiceNote ?? null,
      description: readRow.description ?? null,
      fingerprints: pages.map((page) => page.fingerprint),
      pages,
    }
  })

  return [...fromTransactions, ...fromDrafts]
}
