import { sql } from '@payloadcms/db-vercel-postgres'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
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
  investmentId: number
  investmentName: string
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
  scanMode: ScanModeT
  aiRead: ExpenseDraftReadT | undefined
}

const DRAFT_MEDIA = sql`
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', m.id, 'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type
    ) ORDER BY dm.position)
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

// The AI read only prefills an acceptance, so a decided draft — most of a history page — leaves it
// behind instead of shipping it to the browser.
const DRAFT_SELECT = sql`
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, d.status, d.sent_at, d.decided_at, d.scan_mode,
    CASE WHEN d.status = 'pending' THEN d.ai_read END AS ai_read, ${DRAFT_MEDIA} AS media,
    ${DRAFT_TRANSFERS} AS transfers, decider.name AS decided_by_name, d.duplicate_of
  FROM worker_expense_drafts d
  JOIN users w ON w.id = d.worker_id
  JOIN investments i ON i.id = d.investment_id
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

function toDraftRow(row: Record<string, unknown>): ExpenseDraftRowT {
  const duplicateOf = duplicateOfSchema.safeParse(row.duplicate_of)
  return {
    id: Number(row.id),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    investmentId: Number(row.investment_id),
    investmentName: text(row.investment_name),
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
    scanMode: row.scan_mode as ScanModeT,
    aiRead: toDraftRead(row.ai_read),
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
    investmentId: number
    cashRegisterId: number
    note: string | null
    scanMode: ScanModeT
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
        ${draft.scanMode}
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
  AND EXISTS (SELECT 1 FROM investments iv WHERE iv.id = d.investment_id AND iv.trashed_at IS NULL)
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
    SELECT dt.draft_id, d.status AS row_status, dt.transfer_id, NULL::int AS receipt_id,
      dt.media_ids, 0 AS kind, dt.transfer_id AS part, NULL::jsonb AS duplicate_of
    FROM worker_expense_draft_transfers dt JOIN worker_expense_drafts d ON d.id = dt.draft_id
    UNION ALL
    SELECT sr.draft_id, 'rejected', NULL, sr.id, sr.media_ids, 1, sr.id, sr.duplicate_of
    FROM worker_expense_draft_skipped_receipts sr
    UNION ALL
    SELECT d.id, d.status, NULL, NULL, '{}'::int[], 0, 0, d.duplicate_of
    FROM worker_expense_drafts d
    WHERE NOT EXISTS (SELECT 1 FROM worker_expense_draft_transfers dt WHERE dt.draft_id = d.id)
  ), pr AS (
    SELECT p.*, count(*) OVER (PARTITION BY p.draft_id) AS row_count FROM paragons p
  )
`

const PARAGON_FROM = sql`FROM pr JOIN worker_expense_drafts d ON d.id = pr.draft_id`

const PARAGON_SELECT = sql`
  ${PARAGON_ROWS}
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, pr.row_status AS status, d.sent_at, d.decided_at, d.scan_mode,
    CASE WHEN d.status = 'pending' THEN d.ai_read END AS ai_read, pr.receipt_id,
    (pr.receipt_id IS NOT NULL AND ${PARTIES_NOT_TRASHED}) AS is_restorable,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', m.id, 'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type
      ) ORDER BY dm.position)
      FROM worker_expense_draft_media dm JOIN media m ON m.id = dm.media_id
      WHERE dm.draft_id = d.id
        AND (pr.row_count = 1 OR cardinality(pr.media_ids) = 0 OR dm.media_id = ANY(pr.media_ids))
    ), '[]'::json) AS media,
    COALESCE((
      SELECT json_agg(${TRANSFER_JSON}) FROM transactions t WHERE t.id = pr.transfer_id
    ), '[]'::json) AS transfers,
    decider.name AS decided_by_name, pr.duplicate_of
  ${PARAGON_FROM}
  JOIN users w ON w.id = d.worker_id
  JOIN investments i ON i.id = d.investment_id
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

export async function countPendingExpenseDrafts(db: DbExecutorT): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total
    FROM worker_expense_drafts d JOIN investments i ON i.id = d.investment_id
    WHERE ${PENDING_DRAFT}
  `)
  return Number(res.rows[0]?.total ?? 0)
}

export type ExpenseDraftFiltersT = QueueFiltersT<ExpenseDraftStatusT> & { duplicatesOnly?: boolean }

const QUEUE_ORDER = sql`d.status <> 'pending', d.sent_at DESC, ${PARAGON_ORDER}`

const SORT_EXPRESSIONS: Record<ServerSortableDraftColumnT, SqlT> = {
  workerName: sql`w.name`,
  investmentName: sql`i.name`,
  sentAt: sql`d.sent_at`,
  decidedAt: sql`d.decided_at`,
  // Queue order rather than alphabetical, which would put „Przyjęte" ahead of „Czeka".
  status: sql`array_position(ARRAY[${sqlList(EXPENSE_DRAFT_STATUSES)}]::text[], pr.row_status)`,
}

// An unknown column falls back to the queue, since the column picks a SQL fragment, not a bound
// value. A pending draft has no decision, so it trails a decision sort either way.
function draftHistoryOrderBy(sort: string | undefined): SqlT {
  if (!sort) return QUEUE_ORDER
  const column = sortParamColumnId(sort)
  if (!isServerSortableDraftColumn(column)) return QUEUE_ORDER
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

/**
 * Only a pending draft moves, so two managers deciding at once cannot both win — the loser's
 * update matches no row and the caller reports it.
 */
export async function decideExpenseDraft(
  db: DbExecutorT,
  decision: {
    draftId: number
    decidedBy: number
    status: Exclude<ExpenseDraftStatusT, 'pending'>
    transferIds: number[]
    // Positional to `transferIds`: the draft's pages each transakcja was booked from.
    transferMediaIds?: number[][]
    skippedReceipts?: SkippedReceiptT[]
    duplicateOf?: DuplicateOfT
  },
): Promise<boolean> {
  const transfers = decision.transferIds.map((id, i) => ({
    id,
    media_ids: decision.transferMediaIds?.[i] ?? [],
  }))
  const skipped = (decision.skippedReceipts ?? []).map((receipt) => ({
    media_ids: receipt.mediaIds,
    duplicate_of: receipt.duplicateOf ?? null,
  }))
  // A page id the client sends lands only if it is one of this draft's pages.
  const ownPages = sql`ARRAY(
    SELECT unnest(r.media_ids) INTERSECT
    SELECT dm.media_id FROM worker_expense_draft_media dm WHERE dm.draft_id = decided.id
  )`
  const res = await db.execute(sql`
    WITH decided AS (
      UPDATE worker_expense_drafts
      SET status = ${decision.status}, decided_at = now(), decided_by = ${decision.decidedBy},
        duplicate_of = ${decision.duplicateOf ? JSON.stringify(decision.duplicateOf) : null}::jsonb
      WHERE id = ${decision.draftId} AND status = 'pending'
      RETURNING id
    ), linked AS (
      INSERT INTO worker_expense_draft_transfers (transfer_id, draft_id, media_ids)
      SELECT r.id, decided.id, ${ownPages}
      FROM decided, jsonb_to_recordset(${JSON.stringify(transfers)}::jsonb) AS r(id int, media_ids int[])
    ), skipped AS (
      INSERT INTO worker_expense_draft_skipped_receipts (draft_id, media_ids, duplicate_of)
      SELECT decided.id, ${ownPages}, r.duplicate_of
      FROM decided,
        jsonb_to_recordset(${JSON.stringify(skipped)}::jsonb) AS r(media_ids int[], duplicate_of jsonb)
    )
    SELECT id FROM decided
  `)
  return res.rows.length > 0
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
 * the parent's read of that paragon (its pages are exactly one read row, fixed by the mode), so
 * `hasRead: false` is the caller's cue to read it afresh. The delete is the gate: a trashed party or
 * a second restore deletes nothing and inserts nothing. `null` = refused.
 */
export async function restoreSkippedReceipt(
  db: DbExecutorT,
  receiptId: number,
): Promise<{ draftId: number; hasRead: boolean } | null> {
  const res = await db.execute(sql`
    WITH restored AS (
      DELETE FROM worker_expense_draft_skipped_receipts sr
      USING worker_expense_drafts d
      WHERE sr.id = ${receiptId} AND sr.draft_id = d.id AND d.status = 'accepted'
        AND cardinality(sr.media_ids) > 0 AND ${PARTIES_NOT_TRASHED}
      RETURNING d.id AS parent_id, d.worker_id, d.investment_id, d.cash_register_id, d.note,
        d.scan_mode, d.sent_at, d.ai_read, sr.media_ids
    ), draft AS (
      INSERT INTO worker_expense_drafts
        (worker_id, investment_id, cash_register_id, note, scan_mode, sent_at, ai_read)
      SELECT worker_id, investment_id, cash_register_id, note, scan_mode, sent_at, (
        SELECT jsonb_build_object('rows', jsonb_build_array(read_row))
        FROM jsonb_array_elements(restored.ai_read -> 'rows') AS read_row
        WHERE ARRAY(SELECT jsonb_array_elements_text(read_row -> 'mediaIds')::int ORDER BY 1)
          = ARRAY(SELECT unnest(restored.media_ids) ORDER BY 1)
        LIMIT 1
      )
      FROM restored
      RETURNING id, ai_read IS NOT NULL AS has_read
    ), pages AS (
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      SELECT draft.id, dm.media_id, dm.position
      FROM draft, restored JOIN worker_expense_draft_media dm ON dm.draft_id = restored.parent_id
      WHERE dm.media_id = ANY(restored.media_ids)
    )
    SELECT id, has_read FROM draft
  `)
  const row = res.rows[0]
  return row ? { draftId: Number(row.id), hasRead: row.has_read === true } : null
}

/**
 * Only the sender, and only while the draft waits — a decided one is a record. A changed mode drops
 * the read, which answered the other question; the old mode comes from a CTE because `RETURNING`
 * sees only the new row.
 */
export async function updatePendingExpenseDraft(
  db: DbExecutorT,
  draft: {
    draftId: number
    workerId: number
    investmentId: number
    cashRegisterId: number
    note: string | null
    scanMode: ScanModeT
  },
): Promise<{ isUpdated: boolean; isScanModeChanged: boolean }> {
  const res = await db.execute(sql`
    WITH before AS (
      SELECT id, scan_mode FROM worker_expense_drafts
      WHERE id = ${draft.draftId} AND worker_id = ${draft.workerId} AND status = 'pending'
      FOR UPDATE
    )
    UPDATE worker_expense_drafts d
    SET investment_id = ${draft.investmentId}, cash_register_id = ${draft.cashRegisterId},
      note = ${draft.note}, scan_mode = ${draft.scanMode},
      ai_read = CASE WHEN before.scan_mode = ${draft.scanMode} THEN d.ai_read END
    FROM before
    WHERE d.id = before.id
    RETURNING before.scan_mode <> d.scan_mode AS is_scan_mode_changed
  `)
  const row = res.rows[0]
  return { isUpdated: row !== undefined, isScanModeChanged: row?.is_scan_mode_changed === true }
}

// The read answered for the old pages; the statement that changes them drops it.
const clearRead = (draftId: number, changed: SqlT) => sql`
  UPDATE worker_expense_drafts SET ai_read = NULL
  WHERE id = ${draftId} AND EXISTS (SELECT 1 FROM ${changed})
`

/**
 * Appended after the draft's last page, and like the send only when every page is media the worker
 * uploaded himself. `false` = refused (not his, no longer pending, or a foreign page).
 */
export async function appendExpenseDraftPages(
  db: DbExecutorT,
  pages: { draftId: number; workerId: number; mediaIds: number[] },
): Promise<boolean> {
  const values = pages.mediaIds.map((mediaId, position) => sql`(${mediaId}::int, ${position}::int)`)
  const res = await db.execute(sql`
    WITH draft AS (
      SELECT id FROM worker_expense_drafts
      WHERE id = ${pages.draftId} AND worker_id = ${pages.workerId} AND status = 'pending'
    ), pages_in AS (
      SELECT v.media_id, v.position
      FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(media_id, position)
      JOIN media m ON m.id = v.media_id AND m.created_by_id = ${pages.workerId}
    ), next AS (
      SELECT COALESCE(MAX(position) + 1, 0) AS start
      FROM worker_expense_draft_media WHERE draft_id = ${pages.draftId}
    ), added AS (
      INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
      SELECT draft.id, pages_in.media_id, next.start + pages_in.position FROM draft, pages_in, next
      WHERE (SELECT count(*) FROM pages_in) = ${pages.mediaIds.length}
      RETURNING media_id
    ), cleared AS (${clearRead(pages.draftId, sql`added`)})
    SELECT media_id FROM added
  `)
  return res.rows.length === pages.mediaIds.length
}

/** A draft keeps at least one page — the whole wydatek is what goes once the last photo would. */
export async function removeExpenseDraftPage(
  db: DbExecutorT,
  page: { draftId: number; workerId: number; mediaId: number },
): Promise<boolean> {
  const res = await db.execute(sql`
    WITH removed AS (
      DELETE FROM worker_expense_draft_media dm
      USING worker_expense_drafts d
      WHERE dm.draft_id = d.id AND d.id = ${page.draftId} AND d.worker_id = ${page.workerId}
        AND d.status = 'pending' AND dm.media_id = ${page.mediaId}
        AND (SELECT count(*) FROM worker_expense_draft_media WHERE draft_id = ${page.draftId}) > 1
      RETURNING dm.media_id
    ), cleared AS (${clearRead(page.draftId, sql`removed`)})
    SELECT media_id FROM removed
  `)
  return res.rows.length > 0
}

export async function loadExpenseDraftForRead(
  db: DbExecutorT,
  draftId: number,
): Promise<
  | { scanMode: ScanModeT; pages: ExpenseDraftMediaT[]; aiRead: ExpenseDraftReadT | undefined }
  | undefined
> {
  const res = await db.execute(sql`
    SELECT d.scan_mode, d.ai_read, ${DRAFT_MEDIA} AS media
    FROM worker_expense_drafts d
    WHERE d.id = ${draftId} AND d.status = 'pending'
  `)
  const row = res.rows[0]
  if (!row) return undefined
  return {
    scanMode: row.scan_mode as ScanModeT,
    pages: toDraftMedia(row.media),
    aiRead: toDraftRead(row.ai_read),
  }
}

/**
 * Stored only while the draft still holds exactly the pages and the mode it was read for — a read
 * that finished after the worker changed either would prefill an answer to a question nobody asks.
 */
export async function saveExpenseDraftRead(
  db: DbExecutorT,
  read: { draftId: number; scanMode: ScanModeT; mediaIds: number[]; read: ExpenseDraftReadT },
): Promise<void> {
  await db.execute(sql`
    UPDATE worker_expense_drafts d SET ai_read = ${JSON.stringify(read.read)}::jsonb
    WHERE d.id = ${read.draftId} AND d.status = 'pending' AND d.scan_mode = ${read.scanMode}
      AND (SELECT array_agg(dm.media_id ORDER BY dm.position)
           FROM worker_expense_draft_media dm WHERE dm.draft_id = d.id)
          = ARRAY[${sqlList(read.mediaIds)}]::int[]
  `)
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

/** `null` when the draft is not the worker's own pending one. */
export async function countPendingDraftPages(
  db: DbExecutorT,
  draft: { draftId: number; workerId: number },
): Promise<number | null> {
  const res = await db.execute(sql`
    SELECT count(dm.media_id)::int AS total
    FROM worker_expense_drafts d
    LEFT JOIN worker_expense_draft_media dm ON dm.draft_id = d.id
    WHERE d.id = ${draft.draftId} AND d.worker_id = ${draft.workerId} AND d.status = 'pending'
    GROUP BY d.id
  `)
  return numOrNull(res.rows[0]?.total)
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
