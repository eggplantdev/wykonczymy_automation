import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export const TRASH_RETENTION_DAYS = 30

// „Realnie użyty" (owner's ruling): someone typed a Przedmiar or measured work on a stage. Price,
// rabat, versions and bare pozycje from a szablon do not count — a template seed alone is what an
// untouched kosztorys looks like. One fragment on purpose: the /kosz label and the purge both read
// it, and if they could disagree a row labelled „usunie się samo" might never be purged.
// Expects `investments` aliased as `i`.
const KOSZTORYS_USED = sql`(
  EXISTS (
    SELECT 1 FROM kosztorys_items ki
    WHERE ki.investment_id = i.id AND ki.planned_qty <> 0
  )
  OR EXISTS (
    SELECT 1 FROM stage_progress sp
    JOIN kosztorys_items ki ON ki.id = sp.item_id
    WHERE ki.investment_id = i.id AND sp.qty_done <> 0
  )
)`

export type TrashedInvestmentRowT = {
  id: number
  name: string
  trashedAt: Date
  isKosztorysUsed: boolean
}

export async function fetchTrashedInvestments(db: DbExecutorT): Promise<TrashedInvestmentRowT[]> {
  const { rows } = await db.execute(sql`
    SELECT i.id, i.name, i.trashed_at, ${KOSZTORYS_USED} AS used
    FROM investments i
    WHERE i.trashed_at IS NOT NULL
    ORDER BY i.trashed_at DESC
  `)
  return rows.map((row) => ({
    id: Number(row.id),
    name: String(row.name),
    trashedAt: new Date(row.trashed_at as string),
    isKosztorysUsed: row.used === true,
  }))
}

export async function isKosztorysUsed(db: DbExecutorT, investmentId: number): Promise<boolean> {
  const { rows } = await db.execute(
    sql`SELECT ${KOSZTORYS_USED} AS used FROM investments i WHERE i.id = ${investmentId}`,
  )
  return rows[0]?.used === true
}

export async function selectPurgeableInvestmentIds(
  db: DbExecutorT,
  olderThanDays: number,
): Promise<{ purgeable: number[]; skippedKosztorys: number }> {
  const { rows } = await db.execute(sql`
    SELECT i.id, ${KOSZTORYS_USED} AS used
    FROM investments i
    WHERE i.trashed_at < now() - make_interval(days => ${olderThanDays})
    ORDER BY i.id
  `)
  return {
    purgeable: rows.filter((row) => row.used !== true).map((row) => Number(row.id)),
    skippedKosztorys: rows.filter((row) => row.used === true).length,
  }
}
