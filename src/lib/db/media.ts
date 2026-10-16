import { sql } from '@payloadcms/db-postgres'
import type { MediaKindT } from '@/types/media'
import type { DbExecutorT } from './get-db'

type NewMediaRowT = {
  filename: string
  mimeType: string
  filesize: number
  kind: MediaKindT | null
  createdById: number
}

export async function insertMediaRow(db: DbExecutorT, row: NewMediaRowT): Promise<number> {
  const url = `/api/media/file/${encodeURIComponent(row.filename)}`
  const { rows } = await db.execute(sql`
    INSERT INTO media (filename, url, mime_type, filesize, kind, created_by_id)
    VALUES (${row.filename}, ${url}, ${row.mimeType}, ${row.filesize}, ${row.kind}, ${row.createdById})
    RETURNING id
  `)
  return Number(rows[0].id)
}

export async function deleteMediaRow(db: DbExecutorT, id: number): Promise<void> {
  await db.execute(sql`DELETE FROM media WHERE id = ${id}`)
}

/**
 * The register route deletes a refused blob only when this is false: it takes the key from the
 * client, and Blob has no undelete for a faktura it named by mistake.
 */
export async function isMediaFilenameReferenced(
  db: DbExecutorT,
  filename: string,
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM media WHERE filename = ${filename} OR sizes_thumbnail_filename = ${filename}
    ) AS referenced
  `)
  return Boolean(rows[0].referenced)
}
