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
 * A `media` row for bytes already in Blob under `filename`, written without Payload's upload
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
