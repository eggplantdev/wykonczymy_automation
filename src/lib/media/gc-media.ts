import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { FILE_TRASH_RETENTION_DAYS } from '@/lib/constants/trash'
import type { DbExecutorT } from '@/lib/db/get-db'
import { MEDIA_RELATIONS, RAW_MEDIA_HOLDER_TABLES } from '@/lib/media/relating-collections'
import { logError } from '@/lib/utils/log-error'

// Each delete also clears its Blob file; the cap keeps a backlog night inside the cron's 300 s.
const MAX_DELETES_PER_RUN = 100

const HOLDER_TABLES = [
  ...MEDIA_RELATIONS.map(({ relsTable }) => relsTable),
  ...RAW_MEDIA_HOLDER_TABLES,
]

const isReferenced = sql.join(
  HOLDER_TABLES.map(
    (table) => sql`EXISTS (SELECT 1 FROM ${sql.identifier(table)} h WHERE h.media_id = m.id)`,
  ),
  sql.raw(' OR '),
)

/**
 * Counts references rather than trusting the trash, so a file a cascade left behind enters the trash
 * here, and an entry whose file is attached again is closed before anything gets deleted.
 */
export async function gcMedia(
  payload: Payload,
  db: DbExecutorT,
): Promise<{ recorded: number; healed: number; deleted: number; failed: number }> {
  const recorded = await db.execute(sql`
    INSERT INTO media_detachments (media_id)
    SELECT m.id FROM media m WHERE NOT (${isReferenced})
    ON CONFLICT (media_id) WHERE restored_at IS NULL DO NOTHING
    RETURNING id
  `)

  const healed = await db.execute(sql`
    UPDATE media_detachments d SET restored_at = now()
    FROM media m
    WHERE m.id = d.media_id AND d.restored_at IS NULL AND (${isReferenced})
    RETURNING d.id
  `)

  const expired = await db.execute(sql`
    SELECT media_id FROM media_detachments
    WHERE restored_at IS NULL
      AND detached_at < now() - make_interval(days => ${FILE_TRASH_RETENTION_DAYS})
    ORDER BY detached_at
    LIMIT ${MAX_DELETES_PER_RUN}
  `)

  let deleted = 0
  let failed = 0
  for (const row of expired.rows) {
    try {
      await payload.delete({ collection: 'media', id: Number(row.media_id) })
      deleted++
    } catch (err) {
      failed++
      logError(`[media] gc delete of media ${row.media_id} failed`, err)
    }
  }

  return { recorded: recorded.rows.length, healed: healed.rows.length, deleted, failed }
}
