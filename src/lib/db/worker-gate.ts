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
