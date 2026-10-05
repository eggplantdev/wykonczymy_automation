import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'
import { sqlList } from './sql-list'

export async function filterMediaUploadedBy(
  db: DbExecutorT,
  mediaIds: number[],
  userId: number,
): Promise<number[]> {
  if (mediaIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT id FROM media WHERE created_by_id = ${userId} AND id IN (${sqlList(mediaIds)})
  `)
  return res.rows.map((row) => Number(row.id))
}
