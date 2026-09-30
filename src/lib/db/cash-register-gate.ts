import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import { CASH_REGISTER_TRASHED_MESSAGE } from '@/lib/constants/trash'

/** The refusal when any of these kasy sits in the trash. A missing id is not trashed. */
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
