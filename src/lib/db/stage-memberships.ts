import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

// Not `server-only`: the users collection's delete guard imports it, and that graph also loads
// under `payload generate:types`, where `server-only` throws.
export async function countStageMemberships(
  db: DbExecutorT,
  workerId: string | number,
): Promise<number> {
  const { rows } = await db.execute(sql`
    SELECT count(*)::int AS total FROM kosztorys_stage_workers WHERE worker_id = ${Number(workerId)}
  `)

  return Number(rows[0]?.total ?? 0)
}
