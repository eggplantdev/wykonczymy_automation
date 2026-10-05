import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'

export const EXPENSE_DRAFT_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type ExpenseDraftStatusT = (typeof EXPENSE_DRAFT_STATUSES)[number]

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
  transferId: number | null
  media: ExpenseDraftMediaT[]
}

const DRAFT_SELECT = sql`
  SELECT d.id, d.worker_id, w.name AS worker_name, d.investment_id, i.name AS investment_name,
    d.cash_register_id, d.note, d.status, d.sent_at, d.decided_at, d.transfer_id,
    COALESCE((
      SELECT json_agg(json_build_object(
        'id', m.id, 'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type
      ) ORDER BY dm.position)
      FROM worker_expense_draft_media dm JOIN media m ON m.id = dm.media_id
      WHERE dm.draft_id = d.id
    ), '[]'::json) AS media
  FROM worker_expense_drafts d
  JOIN users w ON w.id = d.worker_id
  JOIN investments i ON i.id = d.investment_id
`

function toDraftRow(row: Record<string, unknown>): ExpenseDraftRowT {
  const media = (row.media ?? []) as Record<string, unknown>[]
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
    transferId: numOrNull(row.transfer_id),
    media: media.map((m) => ({
      id: Number(m.id),
      url: text(m.url),
      filename: text(m.filename),
      mimeType: text(m.mimeType),
    })),
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
      INSERT INTO worker_expense_drafts (worker_id, investment_id, cash_register_id, note)
      SELECT ${draft.workerId}, ${draft.investmentId}, ${draft.cashRegisterId}, ${draft.note}
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

export async function listWorkerExpenseDrafts(
  db: DbExecutorT,
  workerId: number,
): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE d.worker_id = ${workerId}
    ORDER BY d.sent_at DESC, d.id DESC
  `)
  return res.rows.map(toDraftRow)
}

export async function listPendingExpenseDrafts(db: DbExecutorT): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE d.status = 'pending' AND i.trashed_at IS NULL
    ORDER BY d.sent_at, d.id
  `)
  return res.rows.map(toDraftRow)
}

export async function listRejectedExpenseDrafts(
  db: DbExecutorT,
  limit: number,
): Promise<ExpenseDraftRowT[]> {
  const res = await db.execute(sql`
    ${DRAFT_SELECT}
    WHERE d.status = 'rejected' AND i.trashed_at IS NULL
    ORDER BY d.decided_at DESC, d.id DESC
    LIMIT ${limit}
  `)
  return res.rows.map(toDraftRow)
}

export async function readExpenseDraft(
  db: DbExecutorT,
  draftId: number,
): Promise<ExpenseDraftRowT | null> {
  const res = await db.execute(sql`${DRAFT_SELECT} WHERE d.id = ${draftId}`)
  const row = res.rows[0]
  return row ? toDraftRow(row) : null
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
    UPDATE worker_expense_drafts
    SET status = 'pending', decided_at = NULL, decided_by = NULL, transfer_id = NULL
    WHERE id = ${draftId} AND status = 'rejected'
    RETURNING id
  `)
  return res.rows.length > 0
}

/** Only the sender, and only while the draft waits — a decided one is a record. */
export async function updatePendingExpenseDraft(
  db: DbExecutorT,
  draft: {
    draftId: number
    workerId: number
    investmentId: number
    cashRegisterId: number
    note: string | null
  },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE worker_expense_drafts
    SET investment_id = ${draft.investmentId}, cash_register_id = ${draft.cashRegisterId},
      note = ${draft.note}
    WHERE id = ${draft.draftId} AND worker_id = ${draft.workerId} AND status = 'pending'
    RETURNING id
  `)
  return res.rows.length > 0
}

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
    )
    INSERT INTO worker_expense_draft_media (draft_id, media_id, position)
    SELECT draft.id, pages_in.media_id, next.start + pages_in.position FROM draft, pages_in, next
    WHERE (SELECT count(*) FROM pages_in) = ${pages.mediaIds.length}
    RETURNING media_id
  `)
  return res.rows.length === pages.mediaIds.length
}

/** A draft keeps at least one page — the whole wydatek is what goes once the last photo would. */
export async function removeExpenseDraftPage(
  db: DbExecutorT,
  page: { draftId: number; workerId: number; mediaId: number },
): Promise<boolean> {
  const res = await db.execute(sql`
    DELETE FROM worker_expense_draft_media dm
    USING worker_expense_drafts d
    WHERE dm.draft_id = d.id AND d.id = ${page.draftId} AND d.worker_id = ${page.workerId}
      AND d.status = 'pending' AND dm.media_id = ${page.mediaId}
      AND (SELECT count(*) FROM worker_expense_draft_media WHERE draft_id = ${page.draftId}) > 1
    RETURNING dm.media_id
  `)
  return res.rows.length > 0
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

/** The expenses booked from accepted drafts — all of them, or only those among `transferIds`. */
export async function listDraftTransferIds(
  db: DbExecutorT,
  transferIds?: number[],
): Promise<number[]> {
  if (transferIds?.length === 0) return []
  const among = transferIds
    ? sql`AND transfer_id IN (${sql.join(
        transferIds.map((id) => sql`${id}`),
        sql.raw(', '),
      )})`
    : sql``
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
    WHERE media_id IN (${sql.join(
      mediaIds.map((id) => sql`${id}`),
      sql.raw(', '),
    )})
  `)
  return res.rows.map((row) => Number(row.media_id))
}

export async function countDraftsHoldingMedia(db: DbExecutorT, mediaId: number): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM worker_expense_draft_media WHERE media_id = ${mediaId}
  `)
  return Number(res.rows[0]?.total ?? 0)
}
