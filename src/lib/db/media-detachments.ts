import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'
import { sqlList } from './sql-list'

export type DetachmentSourceT = { collection: string; field: string; id: number }

/** A file already in the trash takes the latest source and restarts its grace window. */
export async function recordDetachments(
  db: DbExecutorT,
  source: DetachmentSourceT,
  mediaIds: number[],
): Promise<void> {
  if (mediaIds.length === 0) return
  const values = sql.join(
    mediaIds.map(
      (mediaId) => sql`(${mediaId}, ${source.collection}, ${source.field}, ${source.id})`,
    ),
    sql.raw(', '),
  )
  await db.execute(sql`
    INSERT INTO media_detachments (media_id, from_collection, from_field, from_id)
    VALUES ${values}
    ON CONFLICT (media_id) WHERE restored_at IS NULL DO UPDATE SET
      from_collection = EXCLUDED.from_collection,
      from_field = EXCLUDED.from_field,
      from_id = EXCLUDED.from_id,
      detached_at = now()
  `)
}

export async function closeDetachments(db: DbExecutorT, mediaIds: number[]): Promise<void> {
  if (mediaIds.length === 0) return
  await db.execute(sql`
    UPDATE media_detachments SET restored_at = now()
    WHERE restored_at IS NULL AND media_id IN (${sqlList(mediaIds)})
  `)
}
