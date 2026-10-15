import { sql } from '@payloadcms/db-postgres'
import {
  EXPENSE_DRAFT_STATUSES,
  type ExpenseDraftStatusT,
} from '@/lib/constants/worker-expense-drafts'
import { sortParamColumnId } from '@/lib/table/sort-param'
import type { QueueFiltersT } from '@/types/filters'
import type { PaginationParamsT } from '@/lib/utils/pagination'
import {
  isServerSortableDraftColumn,
  type ServerSortableDraftColumnT,
} from '@/lib/worker-expenses/sortable-columns'
import type { ReferenceItemT } from '@/types/reference-data'
import {
  duplicateOfSchema,
  type DuplicateOfT,
  type SkippedReceiptT,
} from '@/lib/expense-duplicates/duplicate-of'
import type { DeleteProbeT } from './delete-blocker'
import { expenseDraftReadSchema, type ExpenseDraftReadT } from './expense-draft-read'
import type { DbExecutorT } from './get-db'
import { MEDIA_JSON } from './media-json'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'
import { queueFiltersWhere } from './queue-filters-where'
import { inList, sqlList, type SqlT } from './sql-list'

export type ExpenseDraftMediaT = { id: number; url: string; filename: string; mimeType: string }

// Read off the transaction, not the draft: the manager may book it to another investment.
export type ExpenseDraftTransferT = {
  id: number
  amount: number
  investmentId: number | null
  cancelled: boolean
}

export type ExpenseDraftRowT = {
  id: number
  workerId: number
  workerName: string
  investmentId: number | null
  investmentName: string | null
  cashRegisterId: number
  note: string | null
  status: ExpenseDraftStatusT
  sentAt: string
  decidedAt: string | null
  decidedByName: string | null
  transfers: ExpenseDraftTransferT[]
  // Set on a history row standing for one paragon the manager skipped while accepting the rest.
  skippedReceipt?: { id: number; isRestorable: boolean }
  // A refusal management marked as a duplicate — shown to management only.
  duplicateOf?: DuplicateOfT
  media: ExpenseDraftMediaT[]
  aiRead: ExpenseDraftReadT | undefined
  // Per paragon of the AI read; absent without one — such a zgłoszenie is decided whole.
  progress?: DraftProgressT
  acceptedReadRows: number[]
  rejectedReceipts: RejectedReceiptT[]
}

export type DraftProgressT = { accepted: number; rejected: number; pending: number }

export type RejectedReceiptT = { id: number; readRow: number | null; mediaIds: number[] }

const DRAFT_MEDIA = sql`
  COALESCE((
    SELECT json_agg(${MEDIA_JSON} ORDER BY dm.position)
    FROM worker_expense_draft_media dm JOIN media m ON m.id = dm.media_id
    WHERE dm.draft_id = d.id
  ), '[]'::json)
`

const TRANSFER_JSON = sql`json_build_object(
  'id', t.id, 'amount', t.amount, 'investmentId', t.investment_id, 'cancelled', t.cancelled
)`

const DRAFT_TRANSFERS = sql`
  COALESCE((
    SELECT json_agg(${TRANSFER_JSON} ORDER BY t.id)
    FROM worker_expense_draft_transfers dt JOIN transactions t ON t.id = dt.transfer_id
    WHERE dt.draft_id = d.id
  ), '[]'::json)
`

const READ_COUNT = sql`CASE WHEN jsonb_typeof(d.ai_read -> 'rows') = 'array'
  THEN jsonb_array_length(d.ai_read -> 'rows') ELSE 0 END`

const DRAFT_DECISIONS = sql`
  ${READ_COUNT} AS read_count,
  ARRAY(
    SELECT DISTINCT unnest(dt.read_rows) FROM worker_expense_draft_transfers dt
    WHERE dt.draft_id = d.id ORDER BY 1
  ) AS booked_read_rows,
  COALESCE((
    SELECT json_agg(json_build_object('id', sr.id, 'readRow', sr.read_row, 'mediaIds', sr.media_ids)
      ORDER BY sr.id)
    FROM worker_expense_draft_skipped_receipts sr WHERE sr.draft_id = d.id
  ), '[]'::json) AS rejected_receipts
`

// The AI read only prefills an acceptance, so a decided draft — most of a history page — leaves it
// behind instead of shipping it to the browser.
const DRAFT_SELECT = sql`
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, d.status, d.sent_at, d.decided_at,
    CASE WHEN d.status = 'pending' THEN d.ai_read END AS ai_read, ${DRAFT_MEDIA} AS media,
    ${DRAFT_TRANSFERS} AS transfers, decider.name AS decided_by_name, d.duplicate_of,
    ${DRAFT_DECISIONS}
  FROM worker_expense_drafts d
  JOIN users w ON w.id = d.worker_id
  LEFT JOIN investments i ON i.id = d.investment_id
  LEFT JOIN users decider ON decider.id = d.decided_by
`

function toDraftMedia(value: unknown): ExpenseDraftMediaT[] {
  return ((value ?? []) as Record<string, unknown>[]).map((m) => ({
    id: Number(m.id),
    url: text(m.url),
    filename: text(m.filename),
    mimeType: text(m.mimeType),
  }))
}

function toDraftTransfers(value: unknown): ExpenseDraftTransferT[] {
  return ((value ?? []) as Record<string, unknown>[]).map((t) => ({
    id: Number(t.id),
    amount: Number(t.amount),
    investmentId: numOrNull(t.investmentId),
    cancelled: t.cancelled === true,
  }))
}

// A stored read that no longer parses is only a lost prefill, never a page that fails to render.
function toDraftRead(value: unknown): ExpenseDraftReadT | undefined {
  const parsed = expenseDraftReadSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function toRejectedReceipts(value: unknown): RejectedReceiptT[] {
  return ((value ?? []) as Record<string, unknown>[]).map((r) => ({
    id: Number(r.id),
    readRow: numOrNull(r.readRow),
    mediaIds: ((r.mediaIds ?? []) as unknown[]).map(Number),
  }))
}

function toProgress(
  status: ExpenseDraftStatusT,
  readCount: number,
  bookedReadRows: number[],
  rejectedReceipts: RejectedReceiptT[],
): DraftProgressT | undefined {
  if (readCount === 0) return undefined
  const booked = bookedReadRows.length
  if (status === 'pending') {
    const rejected = new Set(
      rejectedReceipts.flatMap((r) => (r.readRow === null ? [] : [r.readRow])),
    )
    return {
      accepted: booked,
      rejected: rejected.size,
      pending: readCount - booked - rejected.size,
    }
  }
  if (status === 'rejected') return { accepted: booked, rejected: readCount - booked, pending: 0 }
  // A transakcja booked before read rows were kept names none, so the rest counts as booked.
  const rejected = rejectedReceipts.length
  return { accepted: Math.max(0, readCount - rejected), rejected, pending: 0 }
}

function toDraftRow(row: Record<string, unknown>): ExpenseDraftRowT {
  const duplicateOf = duplicateOfSchema.safeParse(row.duplicate_of)
  const bookedReadRows = ((row.booked_read_rows ?? []) as unknown[]).map(Number)
  const rejectedReceipts = toRejectedReceipts(row.rejected_receipts)
  const draftStatus = (row.draft_status ?? row.status) as ExpenseDraftStatusT
  return {
    id: Number(row.id),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    investmentId: numOrNull(row.investment_id),
    investmentName: textOrNull(row.investment_name),
    cashRegisterId: Number(row.cash_register_id),
    note: textOrNull(row.note),
    status: row.status as ExpenseDraftStatusT,
    sentAt: isoOrNull(row.sent_at) ?? '',
    decidedAt: isoOrNull(row.decided_at),
    decidedByName: textOrNull(row.decided_by_name),
    transfers: toDraftTransfers(row.transfers),
    ...(row.receipt_id != null && {
      skippedReceipt: { id: Number(row.receipt_id), isRestorable: row.is_restorable === true },
    }),
    ...(duplicateOf.success && { duplicateOf: duplicateOf.data }),
    media: toDraftMedia(row.media),
    aiRead: toDraftRead(row.ai_read),
    // A paragon's own row shows its own status; the zgłoszenie's counter belongs on the draft row.
    progress: row.is_paragon_row
      ? undefined
      : toProgress(draftStatus, Number(row.read_count ?? 0), bookedReadRows, rejectedReceipts),
    acceptedReadRows: bookedReadRows,
    rejectedReceipts,
  }
}

/**
 * Draft and pages in one statement, stored only when EVERY page is media the worker uploaded
 * himself — a guessed media id cannot pull someone else's invoice into his draft. `null` = refused.
 */
export async function insertWorkerExpenseDraft(
  db: DbExecutorT,
  draft: {
    workerId: number
    investmentId: number | null
    cashRegisterId: number
    note: string | null
    mediaIds: number[]
  },
): Promise<number | null> {
  const values = draft.mediaIds.map((mediaId, position) => sql`(${mediaId}::int, ${position}::int)`)
  const res = await db.execute(sql`
    WITH pages_in AS (
      SELECT v.media_id, v.position
      FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(media_id, position)
      JOIN media m ON m.id = v.media_id AND m.created_by_id = ${draft.workerId}
    ), draft AS (
      INSERT INTO worker_expense_drafts (worker_id, investment_id, cash_register_id, note, scan_mode)
      SELECT ${draft.workerId}, ${draft.investmentId}, ${draft.cashRegisterId}, ${draft.note},
        'one-per-photo'
      WHERE (SELECT count(*) FROM pages_in) = ${draft.mediaIds.length}
      RETURNING id
    ), pages AS (
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      SELECT draft.id, pages_in.media_id, pages_in.position FROM draft, pages_in
    )
    SELECT id FROM draft
  `)
  return numOrNull(res.rows[0]?.id)
}

// A pending draft holds back the trash of its pracownik, inwestycja and kasa, but a rejected one does
// not — so a refusal may outlive any of them in the trash, where re-opening it would hold back their
// purge and prefill „Przyjmij" with a kasa nobody can book into.
const PARTIES_NOT_TRASHED = sql`
  EXISTS (SELECT 1 FROM users u WHERE u.id = d.worker_id AND u.trashed_at IS NULL)
  AND (d.investment_id IS NULL
    OR EXISTS (SELECT 1 FROM investments iv WHERE iv.id = d.investment_id AND iv.trashed_at IS NULL))
  AND EXISTS (SELECT 1 FROM cash_registers c WHERE c.id = d.cash_register_id AND c.trashed_at IS NULL)
`

// An accepted draft stands behind a booked expense, so it stays listed whatever went to the trash.
const LISTED_DRAFT = sql`(d.status <> 'rejected' OR (${PARTIES_NOT_TRASHED}))`

// A decided zgłoszenie lists one row per paragon: each booked transakcja, each skipped paragon as
// „odrzucony”, and a draft-level row when no transakcja is linked (pending, rejected, or its
// transakcja deleted). The count runs before any filter, so filtering by status never changes which
// pages a row shows: a lone row shows them all, as does a transakcja booked before paragony kept pages.
const PARAGON_ROWS = sql`
  WITH paragons AS (
    SELECT dt.draft_id, 'accepted'::text AS row_status, dt.transfer_id, NULL::int AS receipt_id,
      dt.media_ids, 0 AS kind, dt.transfer_id AS part, NULL::jsonb AS duplicate_of
    FROM worker_expense_draft_transfers dt
    UNION ALL
    SELECT sr.draft_id, 'rejected', NULL, sr.id, sr.media_ids, 1, sr.id, sr.duplicate_of
    FROM worker_expense_draft_skipped_receipts sr
    UNION ALL
    SELECT d.id, d.status, NULL, NULL, '{}'::int[], 0, 0, d.duplicate_of
    FROM worker_expense_drafts d
    WHERE d.status = 'pending'
      OR (NOT EXISTS (SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = d.id)
        AND (d.status <> 'rejected'
          OR NOT EXISTS (SELECT 1 FROM worker_expense_draft_skipped_receipts sr WHERE sr.draft_id = d.id)))
  ), pr AS (
    SELECT p.*, count(*) OVER (PARTITION BY p.draft_id) AS row_count FROM paragons p
  )
`

const PARAGON_FROM = sql`FROM pr JOIN worker_expense_drafts d ON d.id = pr.draft_id`

const PARAGON_SELECT = sql`
  ${PARAGON_ROWS}
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, pr.row_status AS status, d.sent_at, d.decided_at,
    CASE WHEN d.status = 'pending' THEN d.ai_read END AS ai_read, pr.receipt_id,
    (pr.transfer_id IS NOT NULL OR pr.receipt_id IS NOT NULL) AS is_paragon_row,
    (pr.receipt_id IS NOT NULL AND ${PARTIES_NOT_TRASHED}) AS is_restorable,
    COALESCE((
      SELECT json_agg(${MEDIA_JSON} ORDER BY dm.position)
      FROM worker_expense_draft_media dm JOIN media m ON m.id = dm.media_id
      WHERE dm.draft_id = d.id
        AND (pr.row_count = 1 OR cardinality(pr.media_ids) = 0 OR dm.media_id = ANY(pr.media_ids))
    ), '[]'::json) AS media,
    COALESCE((
      SELECT json_agg(${TRANSFER_JSON}) FROM transactions t WHERE t.id = pr.transfer_id
    ), '[]'::json) AS transfers,
    decider.name AS decided_by_name, pr.duplicate_of, d.status AS draft_status, ${DRAFT_DECISIONS}
  ${PARAGON_FROM}
  JOIN users w ON w.id = d.worker_id
  LEFT JOIN investments i ON i.id = d.investment_id
  LEFT JOIN users decider ON decider.id = d.decided_by
`

// Keeps a zgłoszenie's rows together, transakcje before skipped paragony.
const PARAGON_ORDER = sql`d.id DESC, pr.kind, pr.part`

export async function listWorkerExpenseDrafts(
  db: DbExecutorT,
  workerId: number,
): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${PARAGON_SELECT}
    WHERE d.worker_id = ${workerId} AND ${LISTED_DRAFT}
    ORDER BY d.sent_at DESC, ${PARAGON_ORDER}
  `)
  return res.rows.map(toDraftRow)
}

const PENDING_DRAFT = sql`d.status = 'pending' AND i.trashed_at IS NULL`

export async function listPendingExpenseDrafts(db: DbExecutorT): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE ${PENDING_DRAFT}
    ORDER BY d.sent_at, d.id
  `)
  return res.rows.map(toDraftRow)
}

export const PENDING_EXPENSE_DRAFTS_COUNT = sql`
  SELECT count(*)::int AS total
  FROM worker_expense_drafts d LEFT JOIN investments i ON i.id = d.investment_id
  WHERE ${PENDING_DRAFT}
`

export async function countPendingExpenseDrafts(db: DbExecutorT): Promise<number> {
  const res = await db.execute(PENDING_EXPENSE_DRAFTS_COUNT)
  return Number(res.rows[0]?.total ?? 0)
}

export type ExpenseDraftFiltersT = QueueFiltersT<ExpenseDraftStatusT> & { duplicatesOnly?: boolean }

const HISTORY_ORDER = sql`d.sent_at DESC, ${PARAGON_ORDER}`

const SORT_EXPRESSIONS: Record<ServerSortableDraftColumnT, SqlT> = {
  workerName: sql`w.name`,
  investmentName: sql`i.name`,
  sentAt: sql`d.sent_at`,
  decidedAt: sql`d.decided_at`,
  // Queue order rather than alphabetical, which would put „Przyjęte" ahead of „Czeka".
  status: sql`array_position(ARRAY[${sqlList(EXPENSE_DRAFT_STATUSES)}]::text[], pr.row_status)`,
}

// An unknown column falls back to the default order, since the column picks a SQL fragment, not a bound
// value. A pending draft has no decision, so it trails a decision sort either way.
function draftHistoryOrderBy(sort: string | undefined): SqlT {
  if (!sort) return HISTORY_ORDER
  const column = sortParamColumnId(sort)
  if (!isServerSortableDraftColumn(column)) return HISTORY_ORDER
  const direction = sql.raw(sort.startsWith('-') ? 'DESC' : 'ASC')
  return sql`${SORT_EXPRESSIONS[column]} ${direction} NULLS LAST, d.sent_at DESC, ${PARAGON_ORDER}`
}

export async function listExpenseDraftHistory(
  db: DbExecutorT,
  filters: ExpenseDraftFiltersT,
  { page, limit }: PaginationParamsT,
  sort?: string,
): Promise<{ rows: ExpenseDraftRowT[]; totalDocs: number }> {
  // The status filter reads the paragon's own badge; `LISTED_DRAFT` still reads the zgłoszenie's.
  const where = sql`${queueFiltersWhere('d', LISTED_DRAFT, { ...filters, statuses: null })}
    AND ${inList(sql`pr.row_status`, filters.statuses) ?? sql`true`}
    AND ${filters.duplicatesOnly ? sql`pr.duplicate_of IS NOT NULL` : sql`true`}`
  const [res, countRes] = await Promise.all([
    db.execute(sql`
      ${PARAGON_SELECT}
      WHERE ${where}
      ORDER BY ${draftHistoryOrderBy(sort)}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `),
    db.execute(sql`${PARAGON_ROWS} SELECT count(*)::int AS total ${PARAGON_FROM} WHERE ${where}`),
  ])
  return { rows: res.rows.map(toDraftRow), totalDocs: Number(countRes.rows[0]?.total ?? 0) }
}

/** Only parties that have a listed draft — any other option could only filter down to nothing. */
export async function listExpenseDraftFilterOptions(
  db: DbExecutorT,
): Promise<{ investments: ReferenceItemT[]; workers: ReferenceItemT[] }> {
  const [investmentsRes, workersRes] = await Promise.all([
    db.execute(sql`
      SELECT DISTINCT i.id, i.name
      FROM worker_expense_drafts d JOIN investments i ON i.id = d.investment_id
      WHERE ${LISTED_DRAFT}
      ORDER BY i.name
    `),
    db.execute(sql`
      SELECT DISTINCT w.id, w.name
      FROM worker_expense_drafts d JOIN users w ON w.id = d.worker_id
      WHERE ${LISTED_DRAFT}
      ORDER BY w.name
    `),
  ])
  const toItem = (row: Record<string, unknown>) => ({ id: Number(row.id), name: text(row.name) })
  return { investments: investmentsRes.rows.map(toItem), workers: workersRes.rows.map(toItem) }
}

type DecisionRowsT = {
  transferIds: number[]
  // Positional to `transferIds`: the draft's pages each transakcja was booked from.
  transferMediaIds?: number[][]
  // Positional to `transferIds`: the rows of the draft's AI read each transakcja was booked from.
  transferReadRows?: number[][]
  skippedReceipts?: SkippedReceiptT[]
}

function decisionRows(decision: DecisionRowsT) {
  return {
    transfers: decision.transferIds.map((id, i) => ({
      id,
      media_ids: decision.transferMediaIds?.[i] ?? [],
      read_rows: decision.transferReadRows?.[i] ?? [],
    })),
    skipped: (decision.skippedReceipts ?? []).map((receipt) => ({
      media_ids: receipt.mediaIds,
      read_row: receipt.readRow ?? null,
      duplicate_of: receipt.duplicateOf ?? null,
    })),
  }
}

// A page id or read row the client sends lands only if it is one of this draft's own. Follows a
// `decided` CTE carrying the draft's `id` and `read_count`.
function insertDecisions({ transfers, skipped }: ReturnType<typeof decisionRows>) {
  const ownPages = sql`ARRAY(
    SELECT unnest(r.media_ids) INTERSECT
    SELECT dm.media_id FROM worker_expense_draft_media dm WHERE dm.draft_id = decided.id
  )`
  const ownReadRows = sql`ARRAY(
    SELECT unnest(r.read_rows) INTERSECT
    SELECT generate_series(0, decided.read_count - 1)
    ORDER BY 1
  )`
  return sql`linked AS (
      INSERT INTO worker_expense_draft_transfers (transfer_id, draft_id, media_ids, read_rows)
      SELECT r.id, decided.id, ${ownPages}, ${ownReadRows}
      FROM decided, jsonb_to_recordset(${JSON.stringify(transfers)}::jsonb)
        AS r(id int, media_ids int[], read_rows int[])
    ), skipped AS (
      INSERT INTO worker_expense_draft_skipped_receipts (draft_id, media_ids, read_row, duplicate_of)
      SELECT decided.id, ${ownPages}, r.read_row, r.duplicate_of
      FROM decided, jsonb_to_recordset(${JSON.stringify(skipped)}::jsonb)
        AS r(media_ids int[], read_row int, duplicate_of jsonb)
      WHERE r.read_row IS NULL OR r.read_row BETWEEN 0 AND decided.read_count - 1
      RETURNING id, read_row, media_ids
    )`
}

/**
 * Only a pending draft moves, so two managers deciding at once cannot both win — the loser's
 * update matches no row and the caller reports it.
 */
export async function decideExpenseDraft(
  db: DbExecutorT,
  decision: DecisionRowsT & {
    draftId: number
    decidedBy: number
    status: Exclude<ExpenseDraftStatusT, 'pending'>
    duplicateOf?: DuplicateOfT
  },
): Promise<boolean> {
  const res = await db.execute(sql`
    WITH decided AS (
      UPDATE worker_expense_drafts d
      SET status = ${decision.status}, decided_at = now(), decided_by = ${decision.decidedBy},
        duplicate_of = ${decision.duplicateOf ? JSON.stringify(decision.duplicateOf) : null}::jsonb
      WHERE d.id = ${decision.draftId} AND d.status = 'pending'
      RETURNING d.id, ${READ_COUNT} AS read_count
    ), ${insertDecisions(decisionRows(decision))}
    SELECT id FROM decided
  `)
  return res.rows.length > 0
}

const asIntArray = (values: number[]) =>
  sql`ARRAY(SELECT jsonb_array_elements_text(${JSON.stringify(values)}::jsonb)::int)`

/** The read rows of one zgłoszenie already booked or refused — neither can be decided again. */
export const decidedReadRows = (draftId: SqlT) => sql`
  SELECT unnest(dt.read_rows) FROM worker_expense_draft_transfers dt WHERE dt.draft_id = ${draftId}
  UNION
  SELECT sr.read_row FROM worker_expense_draft_skipped_receipts sr
  WHERE sr.draft_id = ${draftId} AND sr.read_row IS NOT NULL
`

const DECIDED_READ_ROWS = decidedReadRows(sql`d.id`)

/**
 * A zgłoszenie stays pending while any paragon of its read waits; then it is przyjęte if anything
 * was booked, else odrzucone. Without a read it has no paragony, so the first decision settles it.
 */
export async function settleExpenseDraft(
  db: DbExecutorT,
  draftId: number,
  decidedBy: number | null,
): Promise<void> {
  await db.execute(sql`
    UPDATE worker_expense_drafts target
    SET status = s.next_status,
      decided_at = CASE WHEN s.next_status = 'pending' THEN NULL
        WHEN target.status = 'pending' THEN now() ELSE target.decided_at END,
      decided_by = CASE WHEN s.next_status = 'pending' THEN NULL
        WHEN target.status = 'pending' THEN ${decidedBy} ELSE target.decided_by END
    FROM (
      SELECT d.id, CASE
        WHEN ${READ_COUNT} > (SELECT count(*) FROM (${DECIDED_READ_ROWS}) decided) THEN 'pending'
        WHEN EXISTS (SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = d.id)
          THEN 'accepted'
        ELSE 'rejected'
      END AS next_status
      FROM worker_expense_drafts d WHERE d.id = ${draftId}
    ) s
    WHERE target.id = s.id
  `)
}

// `clash` names the read rows someone else decided first; the zgłoszenie itself still waits.
export type ParagonRefusalT = { refusal: 'not-pending' } | { refusal: 'clash'; readRows: number[] }

/**
 * Books or refuses some paragony of a pending zgłoszenie, then settles it. Refused once the
 * zgłoszenie is decided or any of these paragony already is, so two managers can't both book one.
 * Returns the refused paragony as stored, for „cofnij".
 */
export async function decideExpenseParagons(
  db: DbExecutorT,
  decision: DecisionRowsT & { draftId: number; decidedBy: number },
): Promise<{ rejected: RejectedReceiptT[] } | ParagonRefusalT> {
  const { transfers, skipped } = decisionRows(decision)
  const requested = [
    ...transfers.flatMap((t) => t.read_rows),
    ...skipped.flatMap((r) => (r.read_row === null ? [] : [r.read_row])),
  ]
  const locked = await db.execute(sql`
    SELECT d.id FROM worker_expense_drafts d
    WHERE d.id = ${decision.draftId} AND d.status = 'pending'
    FOR UPDATE
  `)
  if (locked.rows.length === 0) return { refusal: 'not-pending' }
  const clash = await db.execute(sql`
    SELECT decided.read_row FROM worker_expense_drafts d,
      LATERAL (${DECIDED_READ_ROWS}) decided(read_row)
    WHERE d.id = ${decision.draftId} AND decided.read_row = ANY(${asIntArray(requested)})
    ORDER BY 1
  `)
  if (clash.rows.length > 0) {
    return { refusal: 'clash', readRows: clash.rows.map((row) => Number(row.read_row)) }
  }

  const res = await db.execute(sql`
    WITH decided AS (
      SELECT d.id, ${READ_COUNT} AS read_count FROM worker_expense_drafts d
      WHERE d.id = ${decision.draftId}
    ), ${insertDecisions({ transfers, skipped })}
    SELECT json_build_object('id', id, 'readRow', read_row, 'mediaIds', media_ids) AS receipt
    FROM skipped
  `)
  await settleExpenseDraft(db, decision.draftId, decision.decidedBy)
  return { rejected: toRejectedReceipts(res.rows.map((row) => row.receipt)) }
}

export type ExpenseDraftDecisionsT = Pick<
  ExpenseDraftRowT,
  'status' | 'acceptedReadRows' | 'rejectedReceipts'
>

/** What a „Przyjmij" dialog resyncs to when it can't tell whether its last decision landed. */
export async function findExpenseDraftDecisions(
  db: DbExecutorT,
  draftId: number,
): Promise<ExpenseDraftDecisionsT | undefined> {
  const res = await db.execute(sql`
    SELECT d.status, ${DRAFT_DECISIONS} FROM worker_expense_drafts d WHERE d.id = ${draftId}
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return {
    status: row.status as ExpenseDraftStatusT,
    acceptedReadRows: ((row.booked_read_rows ?? []) as unknown[]).map(Number),
    rejectedReceipts: toRejectedReceipts(row.rejected_receipts),
  }
}

/**
 * „Odrzuć" on the whole zgłoszenie refuses every paragon still waiting. `'no-read'` = it has no
 * paragony, so the caller rejects it whole.
 */
export async function rejectPendingParagons(
  db: DbExecutorT,
  decision: { draftId: number; decidedBy: number; duplicateOf?: DuplicateOfT },
): Promise<'refused' | 'no-read' | 'done'> {
  const res = await db.execute(sql`
    WITH draft AS (
      SELECT d.id, d.ai_read, ${READ_COUNT} AS read_count FROM worker_expense_drafts d
      WHERE d.id = ${decision.draftId} AND d.status = 'pending'
      FOR UPDATE
    ), skipped AS (
      INSERT INTO worker_expense_draft_skipped_receipts (draft_id, media_ids, read_row, duplicate_of)
      SELECT d.id,
        ARRAY(SELECT jsonb_array_elements_text(d.ai_read -> 'rows' -> g -> 'mediaIds')::int),
        g, ${decision.duplicateOf ? JSON.stringify(decision.duplicateOf) : null}::jsonb
      FROM draft d, generate_series(0, d.read_count - 1) g
      WHERE g NOT IN (${DECIDED_READ_ROWS})
    )
    SELECT read_count FROM draft
  `)
  const row = res.rows[0]
  if (!row) return 'refused'
  if (Number(row.read_count) === 0) return 'no-read'
  await settleExpenseDraft(db, decision.draftId, decision.decidedBy)
  return 'done'
}

/**
 * Puts a refused paragon back to „do sprawdzenia" on its own zgłoszenie. Only a paragon named by its
 * read row, and only on a zgłoszenie whose transakcje all name theirs — one booked before read rows
 * were kept would come back unbooked in the acceptance. `false` = not reopened here.
 */
export async function reopenSkippedReceipt(db: DbExecutorT, receiptId: number): Promise<boolean> {
  const res = await db.execute(sql`
    DELETE FROM worker_expense_draft_skipped_receipts sr
    USING worker_expense_drafts d
    WHERE sr.id = ${receiptId} AND sr.draft_id = d.id AND sr.read_row IS NOT NULL
      AND ${PARTIES_NOT_TRASHED}
      AND NOT EXISTS (
        SELECT 1 FROM worker_expense_draft_transfers dt
        WHERE dt.draft_id = d.id AND cardinality(dt.read_rows) = 0
      )
    RETURNING d.id
  `)
  const row = res.rows[0]
  if (!row) return false
  await settleExpenseDraft(db, Number(row.id), null)
  return true
}

/** Only a refusal is undone — an accepted draft already stands behind a booked expense. */
export async function restoreRejectedExpenseDraft(
  db: DbExecutorT,
  draftId: number,
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE worker_expense_drafts d
    SET status = 'pending', decided_at = NULL, decided_by = NULL, duplicate_of = NULL
    WHERE d.id = ${draftId} AND d.status = 'rejected' AND ${PARTIES_NOT_TRASHED}
    RETURNING d.id
  `)
  return res.rows.length > 0
}

/**
 * A skipped paragon comes back as a new pending zgłoszenie sharing the accepted parent's pages, at
 * the parent's send date — re-opening the parent would rebook what it already booked. It carries
 * the parent's read of that paragon, found by its `read_row` — one photo can hold several paragony,
 * so its pages alone don't name it. With no such row it carries an empty read instead of none: a
 * fresh read would list every paragon on the photo, the booked ones too. The delete is the gate: a
 * trashed party or a second restore deletes nothing and inserts nothing. `null` = refused.
 */
export async function restoreSkippedReceipt(
  db: DbExecutorT,
  receiptId: number,
): Promise<number | null> {
  const res = await db.execute(sql`
    WITH restored AS (
      DELETE FROM worker_expense_draft_skipped_receipts sr
      USING worker_expense_drafts d
      WHERE sr.id = ${receiptId} AND sr.draft_id = d.id AND d.status = 'accepted'
        AND cardinality(sr.media_ids) > 0 AND ${PARTIES_NOT_TRASHED}
      RETURNING d.id AS parent_id, d.worker_id, d.investment_id, d.cash_register_id, d.note,
        d.scan_mode, d.sent_at, d.ai_read -> 'rows' -> sr.read_row AS read_row, sr.media_ids
    ), draft AS (
      INSERT INTO worker_expense_drafts
        (worker_id, investment_id, cash_register_id, note, scan_mode, sent_at, ai_read)
      SELECT worker_id, investment_id, cash_register_id, note, scan_mode, sent_at,
        CASE WHEN ARRAY(SELECT jsonb_array_elements_text(read_row -> 'mediaIds')::int ORDER BY 1)
            = ARRAY(SELECT unnest(media_ids) ORDER BY 1)
          THEN jsonb_build_object('rows', jsonb_build_array(read_row))
          ELSE jsonb_build_object('rows', jsonb_build_array(jsonb_build_object('mediaIds', to_jsonb(media_ids))))
        END
      FROM restored
      RETURNING id
    ), pages AS (
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      SELECT draft.id, dm.media_id, dm.position
      FROM draft, restored JOIN worker_expense_draft_media dm ON dm.draft_id = restored.parent_id
      WHERE dm.media_id = ANY(restored.media_ids)
    )
    SELECT id FROM draft
  `)
  const row = res.rows[0]
  return row ? Number(row.id) : null
}

export type MergeRefusalT = 'not-pending' | 'mixed' | 'decided' | 'unread'

/**
 * Folds several pending zgłoszenia of one worker into the oldest, as if he had sent them as one:
 * its read becomes theirs chained in send order, so every paragon stays a read row of the result.
 * Refused once anything inside is decided — a decision names its read row by position, which the
 * chaining shifts — or while one has no read, whose photos would be paragony nothing tracks.
 */
export async function mergeExpenseDrafts(
  db: DbExecutorT,
  draftIds: number[],
): Promise<{ draftId: number } | { refusal: MergeRefusalT }> {
  const locked = await db.execute(sql`
    SELECT d.id, d.worker_id, d.investment_id, d.cash_register_id, d.note, d.status,
      jsonb_typeof(d.ai_read -> 'rows') = 'array' AS has_read,
      EXISTS (SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = d.id)
        OR EXISTS (SELECT 1 FROM worker_expense_draft_skipped_receipts sr WHERE sr.draft_id = d.id)
        AS has_decisions
    FROM worker_expense_drafts d
    WHERE d.id IN (${sqlList(draftIds)})
    ORDER BY d.sent_at, d.id
    FOR UPDATE
  `)
  const rows = locked.rows
  if (rows.length !== draftIds.length || rows.some((row) => row.status !== 'pending')) {
    return { refusal: 'not-pending' }
  }
  const [target] = rows
  const sameParties = rows.every(
    (row) =>
      row.worker_id === target.worker_id &&
      row.investment_id === target.investment_id &&
      row.cash_register_id === target.cash_register_id,
  )
  if (!sameParties) return { refusal: 'mixed' }
  if (rows.some((row) => row.has_decisions === true)) return { refusal: 'decided' }
  if (rows.some((row) => row.has_read !== true)) return { refusal: 'unread' }

  const targetId = Number(target.id)
  const mergedIds = rows.slice(1).map((row) => Number(row.id))
  const note = rows.flatMap((row) => (row.note ? [text(row.note)] : [])).join('\n') || null
  await db.execute(sql`
    WITH ordered AS (
      SELECT d.id, ord FROM unnest(${asIntArray([targetId, ...mergedIds])}) WITH ORDINALITY AS o(id, ord)
      JOIN worker_expense_drafts d ON d.id = o.id
    ), pages AS (
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      SELECT ${targetId}, dm.media_id,
        (SELECT max(position) FROM worker_expense_draft_media WHERE draft_id = ${targetId})
          + row_number() OVER (ORDER BY ordered.ord, dm.position)
      FROM ordered JOIN worker_expense_draft_media dm ON dm.draft_id = ordered.id
      WHERE ordered.id <> ${targetId}
      ON CONFLICT DO NOTHING
    )
    UPDATE worker_expense_drafts SET note = ${note}, ai_read = jsonb_build_object('rows', (
      SELECT jsonb_agg(r.row ORDER BY ordered.ord, r.idx)
      FROM ordered JOIN worker_expense_drafts d ON d.id = ordered.id,
        jsonb_array_elements(d.ai_read -> 'rows') WITH ORDINALITY AS r(row, idx)
    ))
    WHERE id = ${targetId}
  `)
  await db.execute(sql`DELETE FROM worker_expense_drafts WHERE id IN (${sqlList(mergedIds)})`)
  return { draftId: targetId }
}

export async function loadExpenseDraftForRead(
  db: DbExecutorT,
  draftId: number,
): Promise<{ pages: ExpenseDraftMediaT[]; aiRead: ExpenseDraftReadT | undefined } | undefined> {
  const res = await db.execute(sql`
    SELECT d.ai_read, ${DRAFT_MEDIA} AS media
    FROM worker_expense_drafts d
    WHERE d.id = ${draftId} AND d.status = 'pending'
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return {
    pages: toDraftMedia(row.media),
    aiRead: toDraftRead(row.ai_read),
  }
}

/**
 * The first read stored wins: a skipped paragon and a duplicate hint name their row by its position
 * in the read, so a second read finishing later („Zobacz" while the send-time one runs) must not
 * renumber the rows under them. Returns the read the draft holds afterwards, or `undefined` once it
 * is no longer pending.
 */
export async function saveExpenseDraftRead(
  db: DbExecutorT,
  draftId: number,
  read: ExpenseDraftReadT,
): Promise<ExpenseDraftReadT | undefined> {
  const saved = await db.execute(sql`
    UPDATE worker_expense_drafts SET ai_read = ${JSON.stringify(read)}::jsonb
    WHERE id = ${draftId} AND status = 'pending' AND ai_read IS NULL
    RETURNING ai_read
  `)
  if (saved.rows[0]) return toDraftRead(saved.rows[0].ai_read)
  // A second statement, so it sees the winner's commit, which the UPDATE's snapshot could not.
  const stored = await db.execute(sql`
    SELECT ai_read FROM worker_expense_drafts WHERE id = ${draftId} AND status = 'pending'
  `)
  return toDraftRead(stored.rows[0]?.ai_read)
}

/**
 * A decided draft is the record behind an expense or a refusal, so only a pending one goes — and
 * only by its sender. Returns the pages it held (the CTE reads them before the cascade drops the
 * links), or `null` when nothing was deleted.
 */
export async function deletePendingExpenseDraft(
  db: DbExecutorT,
  draft: { draftId: number; workerId: number },
): Promise<number[] | null> {
  const res = await db.execute(sql`
    WITH pages AS (
      SELECT media_id FROM worker_expense_draft_media WHERE draft_id = ${draft.draftId}
    ), deleted AS (
      DELETE FROM worker_expense_drafts
      WHERE id = ${draft.draftId} AND worker_id = ${draft.workerId} AND status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = ${draft.draftId}
        )
      RETURNING id
    )
    SELECT deleted.id, pages.media_id FROM deleted LEFT JOIN pages ON true
  `)
  if (res.rows.length === 0) return null
  return res.rows.flatMap((row) => (row.media_id == null ? [] : [Number(row.media_id)]))
}

export async function listDraftTransferIds(
  db: DbExecutorT,
  transferIds: number[],
): Promise<number[]> {
  if (transferIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT transfer_id FROM worker_expense_draft_transfers
    WHERE transfer_id IN (${sqlList(transferIds)})
  `)
  return res.rows.map((row) => Number(row.transfer_id))
}

export async function listAllDraftTransferIds(db: DbExecutorT): Promise<number[]> {
  const res = await db.execute(sql`SELECT transfer_id FROM worker_expense_draft_transfers`)
  return res.rows.map((row) => Number(row.transfer_id))
}

/**
 * Which of `mediaIds` a draft holds. The draft's pages live in a raw table, so the Payload-relation
 * scan of the media reclaim cannot see them and would take a waiting receipt for an orphan.
 */
export async function findDraftHeldMedia(db: DbExecutorT, mediaIds: number[]): Promise<number[]> {
  if (mediaIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT DISTINCT media_id FROM worker_expense_draft_media
    WHERE media_id IN (${sqlList(mediaIds)})
  `)
  return res.rows.map((row) => Number(row.media_id))
}

const DRAFT_TARGET_COLUMNS = {
  worker: sql`worker_id`,
  investment: sql`investment_id`,
  cashRegister: sql`cash_register_id`,
} as const

const PENDING_DRAFTS_LABEL = 'zgłoszenia wydatków do rozpatrzenia'

// A waiting receipt is money its worker is owed back; the CASCADE would drop it before anyone decided it.
export function pendingDraftsProbe(target: keyof typeof DRAFT_TARGET_COLUMNS): DeleteProbeT {
  return {
    count: async (db, id) => {
      const res = await db.execute(sql`
        SELECT count(*)::int AS total FROM worker_expense_drafts
        WHERE ${DRAFT_TARGET_COLUMNS[target]} = ${Number(id)} AND status = 'pending'
      `)
      return Number(res.rows[0]?.total ?? 0)
    },
    label: PENDING_DRAFTS_LABEL,
  }
}

/** The way out of a refusal the probe caused — moving transakcje does not clear it. */
export function pendingDraftsHint(blockers: string[]): string {
  return blockers.some((blocker) => blocker.startsWith(PENDING_DRAFTS_LABEL))
    ? ' Zgłoszenia wydatków najpierw przyjmij lub odrzuć.'
    : ''
}

export async function countDraftsHoldingMedia(db: DbExecutorT, mediaId: number): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM worker_expense_draft_media WHERE media_id = ${mediaId}
  `)
  return Number(res.rows[0]?.total ?? 0)
}
