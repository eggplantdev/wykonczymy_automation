import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'
import type { ToolPlaneT } from '@/lib/kosztorys/types'

/** A missing id is not trashed. */
export async function trashedWorkerMessage(
  db: DbExecutorT,
  ids: readonly number[],
): Promise<string | undefined> {
  if (ids.length === 0) return undefined
  const res = await db.execute(sql`SELECT trashed_at FROM users WHERE id IN (${sqlList(ids)})`)
  return res.rows.some((row) => row.trashed_at != null) ? WORKER_TRASHED_MESSAGE : undefined
}

/**
 * Etapy in both rozliczenia block a worker's report link (`resolveWorkerScope`), so the write that
 * would mix them is refused instead — an etap with nothing in it yet included. A plane-less legacy
 * etap mixes nothing: it blocks the link on its own, as unconfirmed.
 */
export async function selectOtherPlaneWorkerNames(
  db: DbExecutorT,
  {
    investmentId,
    plane,
    workerIds,
    exceptStageId = 0,
  }: {
    investmentId: number
    plane: ToolPlaneT | null
    workerIds: readonly number[]
    exceptStageId?: number
  },
): Promise<string[]> {
  if (plane === null || workerIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT DISTINCT u.name FROM kosztorys_stage_workers w
    JOIN kosztorys_stages s ON s.id = w.stage_id
    JOIN users u ON u.id = w.worker_id
    WHERE s.investment_id = ${investmentId}
      AND s.id <> ${exceptStageId}
      AND w.worker_id IN (${sqlList(workerIds)})
      AND s.plane IS NOT NULL AND s.plane <> ${plane}
    ORDER BY u.name
  `)
  return res.rows.map((row) => String(row.name))
}

/** Read live, never off the session: the JWT outlives a flag a manager clears. */
export async function canAddExpensesWithoutInvestment(
  db: DbExecutorT,
  workerId: number,
): Promise<boolean> {
  const res = await db.execute(sql`
    SELECT can_add_expenses_without_investment FROM users WHERE id = ${workerId}
  `)
  return res.rows[0]?.can_add_expenses_without_investment === true
}
