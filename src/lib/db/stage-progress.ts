import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

export type StageProgressCellT = { itemId: number; stageId: number; qtyDone: number }

/**
 * ADDS to each cell, where `setStageProgressAction` overwrites it: an accepted report is work on top
 * of what the etap already holds. A negative figure takes a changed acceptance back out, floored at
 * zero — a cell lowered by hand below what was added cannot go negative — and a cell with no row is
 * already zero, so it returns nothing. One row per pozycja is the map's guarantee — an upsert that
 * touches a row twice is a Postgres error (21000). Rows whose etap or pozycja is not this
 * investment's are skipped by the join, not written; the caller compares the returned cells with what
 * it sent.
 */
export async function addStageProgress(
  db: DbExecutorT,
  investmentId: number,
  stageId: number,
  qtyByItem: ReadonlyMap<number, number>,
): Promise<StageProgressCellT[]> {
  const entries = [...qtyByItem].filter(([, qty]) => qty !== 0)
  const additions = entries.filter(([, qty]) => qty > 0)
  const removals = entries.filter(([, qty]) => qty < 0)
  const valuesOf = (list: [number, number][]) =>
    sql.join(
      list.map(([itemId, qty]) => sql`(${itemId}::int, ${qty}::numeric)`),
      sql.raw(', '),
    )

  const rows: Record<string, unknown>[] = []
  if (additions.length > 0) {
    const res = await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      SELECT v.item_id, s.id, v.qty, now(), now()
      FROM (VALUES ${valuesOf(additions)}) AS v(item_id, qty)
      JOIN kosztorys_items i ON i.id = v.item_id AND i.investment_id = ${investmentId}
      JOIN kosztorys_stages s ON s.id = ${stageId} AND s.investment_id = ${investmentId}
      ON CONFLICT (item_id, stage_id)
        DO UPDATE SET qty_done = stage_progress.qty_done + EXCLUDED.qty_done, updated_at = now()
      RETURNING item_id, stage_id, qty_done
    `)
    rows.push(...res.rows)
  }
  if (removals.length > 0) {
    const res = await db.execute(sql`
      UPDATE stage_progress sp
      SET qty_done = GREATEST(sp.qty_done + v.qty, 0), updated_at = now()
      FROM (VALUES ${valuesOf(removals)}) AS v(item_id, qty)
      JOIN kosztorys_items i ON i.id = v.item_id AND i.investment_id = ${investmentId}
      JOIN kosztorys_stages s ON s.id = ${stageId} AND s.investment_id = ${investmentId}
      WHERE sp.item_id = v.item_id AND sp.stage_id = s.id
      RETURNING sp.item_id, sp.stage_id, sp.qty_done
    `)
    rows.push(...res.rows)
  }
  return rows.map((row) => ({
    itemId: Number(row.item_id),
    stageId: Number(row.stage_id),
    qtyDone: Number(row.qty_done),
  }))
}
