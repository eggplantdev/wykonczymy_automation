import { sql } from '@payloadcms/db-vercel-postgres'
import type { MediaKindT } from '@/types/media'
import type { DbExecutorT } from './get-db'

type NewMediaRowT = {
  filename: string
  mimeType: string
  filesize: number
  kind: MediaKindT | null
  createdById: number
}

/**
 * A `media` row for bytes stored in Blob under `filename`, written without Payload's upload
 * pipeline (the download-thumbnail-reupload round trip is what made the worker's send slow). The
 * `url` is the one Payload derives, so `/api/media/file/<filename>` and every reader treat the row
 * like a Payload-made one; the thumbnail and dimension columns stay NULL — no reader of these
 * uploads uses them.
 */
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
 * Whether any row stores bytes under this Blob key — as its original or as its thumbnail. The
 * register route deletes a refused blob only when this is false: it takes the key from the client,
 * and Blob has no undelete for a faktura it named by mistake.
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
