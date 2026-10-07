import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { CASH_REGISTER_TRASHED_MESSAGE } from '@/lib/constants/cash-register-lock'

/** A missing id is not trashed. */
export async function trashedRegisterMessage(
  db: DbExecutorT,
  ids: readonly number[],
): Promise<string | undefined> {
  if (ids.length === 0) return undefined
  const res = await db.execute(
    sql`SELECT trashed_at FROM cash_registers WHERE id IN (${sqlList(ids)})`,
  )
  return res.rows.some((row) => row.trashed_at != null) ? CASH_REGISTER_TRASHED_MESSAGE : undefined
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
