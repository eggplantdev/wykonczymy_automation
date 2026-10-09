import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'

/** A missing id is not trashed. */
export async function trashedWorkerMessage(
  db: DbExecutorT,
  ids: readonly number[],
): Promise<string | undefined> {
  if (ids.length === 0) return undefined
  const res = await db.execute(sql`SELECT trashed_at FROM users WHERE id IN (${sqlList(ids)})`)
  return res.rows.some((row) => row.trashed_at != null) ? WORKER_TRASHED_MESSAGE : undefined
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
