import { sql } from '@payloadcms/db-vercel-postgres'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
import {
  EXPENSE_DRAFT_STATUSES,
  isServerSortableDraftColumn,
  type ExpenseDraftStatusT,
  type ServerSortableDraftColumnT,
} from '@/lib/constants/worker-expense-drafts'
import { sortParamColumnId } from '@/lib/table/sort-param'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { PaginationParamsT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'
import type { DeleteProbeT } from './delete-blocker'
import { expenseDraftReadSchema, type ExpenseDraftReadT } from './expense-draft-read'
import type { DbExecutorT } from './get-db'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'
import { inList, sqlList, type SqlT } from './sql-list'
import { warsawDayWithin } from './sql-warsaw-day'

export type ExpenseDraftMediaT = { id: number; url: string; filename: string; mimeType: string }

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
  transferId: number | null
  // Read off the transaction, not the draft: the manager may book it to another investment.
  transferAmount: number | null
  transferInvestmentId: number | null
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

const DRAFT_SELECT = sql`
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, d.status, d.sent_at, d.decided_at, d.transfer_id, d.scan_mode,
    d.ai_read, ${DRAFT_MEDIA} AS media, decider.name AS decided_by_name, t.amount AS transfer_amount,
    t.investment_id AS transfer_investment_id
  FROM worker_expense_drafts d
  JOIN users w ON w.id = d.worker_id
  JOIN investments i ON i.id = d.investment_id
  LEFT JOIN users decider ON decider.id = d.decided_by
  LEFT JOIN transactions t ON t.id = d.transfer_id
`

function toDraftMedia(value: unknown): ExpenseDraftMediaT[] {
  return ((value ?? []) as Record<string, unknown>[]).map((m) => ({
    id: Number(m.id),
    url: text(m.url),
    filename: text(m.filename),
    mimeType: text(m.mimeType),
  }))
}

// A stored read that no longer parses is only a lost prefill, never a page that fails to render.
function toDraftRead(value: unknown): ExpenseDraftReadT | undefined {
  const parsed = expenseDraftReadSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function toDraftRow(row: Record<string, unknown>): ExpenseDraftRowT {
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
    transferId: numOrNull(row.transfer_id),
    transferAmount: numOrNull(row.transfer_amount),
    transferInvestmentId: numOrNull(row.transfer_investment_id),
    media: toDraftMedia(row.media),
    scanMode: row.scan_mode as ScanModeT,
    aiRead: toDraftRead(row.ai_read),
  }
}

/** A trashed or inactive kasa is no kasa to book into, even the worker's own. */
export async function isWorkerLiveRegister(
  db: DbExecutorT,
  workerId: number,
  cashRegisterId: number,
): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT 1 FROM cash_registers
    WHERE id = ${cashRegisterId} AND owner_id = ${workerId}
      AND trashed_at IS NULL AND active IS NOT FALSE
  `)
  return res.rows.length > 0
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

export async function listWorkerExpenseDrafts(
  db: DbExecutorT,
  workerId: number,
): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE d.worker_id = ${workerId} AND ${LISTED_DRAFT}
    ORDER BY d.sent_at DESC, d.id DESC
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

/** `null` leaves a dimension unfiltered; an empty list matches nothing (the URL named no valid value). */
export type ExpenseDraftFiltersT = {
  statuses: ExpenseDraftStatusT[] | null
  investmentIds: number[] | null
  workerIds: number[] | null
  sentRange: DateRangeT
}

function draftHistoryWhere(filters: ExpenseDraftFiltersT): SqlT {
  const conditions = [
    LISTED_DRAFT,
    inList(sql`d.status`, filters.statuses),
    inList(sql`d.investment_id`, filters.investmentIds),
    inList(sql`d.worker_id`, filters.workerIds),
    ...warsawDayWithin(sql`d.sent_at`, filters.sentRange),
  ].filter((condition) => condition !== undefined)
  return sql.join(conditions, sql.raw(' AND '))
}

const QUEUE_ORDER = sql`d.status <> 'pending', d.sent_at DESC, d.id DESC`

const SORT_EXPRESSIONS: Record<ServerSortableDraftColumnT, SqlT> = {
  workerName: sql`w.name`,
  investmentName: sql`i.name`,
  sentAt: sql`d.sent_at`,
  decidedAt: sql`d.decided_at`,
  // Queue order rather than alphabetical, which would put „Przyjęte" ahead of „Czeka".
  status: sql`array_position(ARRAY[${sqlList(EXPENSE_DRAFT_STATUSES)}]::text[], d.status)`,
}

// An unknown column falls back to the queue, since the column picks a SQL fragment, not a bound
// value. A pending draft has no decision, so it trails a decision sort either way.
function draftHistoryOrderBy(sort: string | undefined): SqlT {
  if (!sort) return QUEUE_ORDER
  const column = sortParamColumnId(sort)
  if (!isServerSortableDraftColumn(column)) return QUEUE_ORDER
  const direction = sql.raw(sort.startsWith('-') ? 'DESC' : 'ASC')
  return sql`${SORT_EXPRESSIONS[column]} ${direction} NULLS LAST, d.sent_at DESC, d.id DESC`
}

/** Without a `sort`, the pending queue first, then the rest newest first. */
export async function listExpenseDraftHistory(
  db: DbExecutorT,
  filters: ExpenseDraftFiltersT,
  { page, limit }: PaginationParamsT,
  sort?: string,
): Promise<{ rows: ExpenseDraftRowT[]; totalDocs: number }> {
  const where = draftHistoryWhere(filters)
  const [res, countRes] = await Promise.all([
    db.execute(sql`
      ${DRAFT_SELECT}
      WHERE ${where}
      ORDER BY ${draftHistoryOrderBy(sort)}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `),
    db.execute(sql`SELECT count(*)::int AS total FROM worker_expense_drafts d WHERE ${where}`),
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

export type RejectedDraftScopeT = {
  investmentIds: number[] | null
  registerIds: number[] | null
  sentRange: DateRangeT
}

export async function listRejectedExpenseDrafts(
  db: DbExecutorT,
  limit: number,
  scope: RejectedDraftScopeT,
): Promise<ExpenseDraftRowT[]> {
  const conditions = [
    sql`d.status = 'rejected'`,
    PARTIES_NOT_TRASHED,
    inList(sql`d.investment_id`, scope.investmentIds),
    inList(sql`d.cash_register_id`, scope.registerIds),
    ...warsawDayWithin(sql`d.sent_at`, scope.sentRange),
  ].filter((condition) => condition !== undefined)
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE ${sql.join(conditions, sql.raw(' AND '))}
    ORDER BY d.decided_at DESC, d.id DESC
    LIMIT ${limit}
  `)
  return res.rows.map(toDraftRow)
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
    transferId: number | null
  },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE worker_expense_drafts
    SET status = ${decision.status}, decided_at = now(), decided_by = ${decision.decidedBy},
      transfer_id = ${decision.transferId}
    WHERE id = ${decision.draftId} AND status = 'pending'
    RETURNING id
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
    SET status = 'pending', decided_at = NULL, decided_by = NULL, transfer_id = NULL
    WHERE d.id = ${draftId} AND d.status = 'rejected' AND ${PARTIES_NOT_TRASHED}
    RETURNING d.id
  `)
  return res.rows.length > 0
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
  transferIds?: number[],
): Promise<number[]> {
  if (transferIds?.length === 0) return []
  const among = transferIds ? sql`AND transfer_id IN (${sqlList(transferIds)})` : sql``
  const res = await db.execute(sql`
    SELECT transfer_id FROM worker_expense_drafts
    WHERE status = 'accepted' AND transfer_id IS NOT NULL ${among}
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
