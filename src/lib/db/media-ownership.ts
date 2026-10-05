import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

/** The subset of `mediaIds` that `userId` uploaded himself. */
export async function filterMediaUploadedBy(
  db: DbExecutorT,
  mediaIds: number[],
  userId: number,
): Promise<number[]> {
  if (mediaIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT id FROM media
    WHERE created_by_id = ${userId} AND id IN (${sql.join(
      mediaIds.map((id) => sql`${id}`),
      sql.raw(', '),
    )})
  `)
  return res.rows.map((row) => Number(row.id))
}
