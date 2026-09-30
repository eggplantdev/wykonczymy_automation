import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

export type StageProgressCellT = { itemId: number; stageId: number; qtyDone: number }

/**
 * ADDS to each cell, where `setStageProgressAction` overwrites it: an accepted report is work on top
 * of what the etap already holds. One row per pozycja is the map's guarantee — an upsert that touches
 * a row twice is a Postgres error (21000). Rows whose etap or pozycja is not this investment's are
 * skipped by the join, not written; the caller compares the returned cells with what it sent.
 */
export async function addStageProgress(
  db: DbExecutorT,
  investmentId: number,
  stageId: number,
  qtyByItem: ReadonlyMap<number, number>,
): Promise<StageProgressCellT[]> {
  if (qtyByItem.size === 0) return []
  const values = [...qtyByItem].map(([itemId, qty]) => sql`(${itemId}::int, ${qty}::numeric)`)
  const res = await db.execute(sql`
    INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
    SELECT v.item_id, s.id, v.qty, now(), now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(item_id, qty)
    JOIN kosztorys_items i ON i.id = v.item_id AND i.investment_id = ${investmentId}
    JOIN kosztorys_stages s ON s.id = ${stageId} AND s.investment_id = ${investmentId}
    ON CONFLICT (item_id, stage_id)
      DO UPDATE SET qty_done = stage_progress.qty_done + EXCLUDED.qty_done, updated_at = now()
    RETURNING item_id, stage_id, qty_done
  `)
  return res.rows.map((row) => ({
    itemId: Number(row.item_id),
    stageId: Number(row.stage_id),
    qtyDone: Number(row.qty_done),
  }))
}
