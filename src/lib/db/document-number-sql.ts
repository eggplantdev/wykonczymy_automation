import { sql } from '@payloadcms/db-vercel-postgres'
import type { SqlT } from './sql-list'

// The SQL twin of `normalizeDocumentNumber`, close enough to pre-filter; the matcher decides.
export const normalizedNumber = (value: SqlT) =>
  sql`upper(regexp_replace(${value}, '\\s', '', 'g'))`

export const noteLine1 = (note: SqlT) => sql`split_part(btrim(${note}, E' \\n\\r\\t'), E'\\n', 1)`
