import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from './get-db'

export async function getInvestmentRecordName(
  db: DbExecutorT,
  id: number,
): Promise<string | undefined> {
  const res = await db.execute(sql`SELECT name FROM investments WHERE id = ${id}`)
  const row = res.rows[0]
  return row ? String(row.name) : undefined
}
