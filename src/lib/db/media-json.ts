import { sql } from '@payloadcms/db-vercel-postgres'
import type { SqlT } from './sql-list'

export const MEDIA_JSON = sql`json_build_object('id', m.id, 'url', m.url, 'filename', m.filename, 'mimeType', m.mime_type)`

// A media row without a url is no file to open — see `PreviewFileT`.
export const transactionInvoicesJson = (transactionId: SqlT) => sql`COALESCE((
  SELECT json_agg(${MEDIA_JSON} ORDER BY r."order")
  FROM transactions_rels r JOIN media m ON m.id = r.media_id
  WHERE r.parent_id = ${transactionId} AND r.path = 'invoice' AND m.url IS NOT NULL
), '[]'::json)`
