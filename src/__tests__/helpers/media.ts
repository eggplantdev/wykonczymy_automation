import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

// Raw INSERT, not payload.create: an upload through Payload would push bytes at the Blob store for a
// fixture nothing ever opens.
export async function insertTestMedia(
  db: DbExecutorT,
  filename: string,
  {
    kind = 'zdjecie',
    createdById = null,
    url = null,
  }: { kind?: string | null; createdById?: number | null; url?: string | null } = {},
): Promise<number> {
  const { rows } = await db.execute(sql`
    INSERT INTO media (filename, mime_type, filesize, kind, created_by_id, url)
    VALUES (${filename}, 'image/jpeg', 1024, ${kind}, ${createdById}, ${url})
    RETURNING id
  `)
  return Number(rows[0].id)
}

export async function purgeTestMedia(db: DbExecutorT, filenamePrefix: string): Promise<void> {
  await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${filenamePrefix}%`}`)
}
