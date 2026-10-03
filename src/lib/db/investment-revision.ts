import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from './get-db'

/** The editor's revision token; other windows compare against it to notice this write. */
export async function bumpInvestmentRevision(
  db: DbExecutorT,
  investmentId: number,
): Promise<string> {
  const res = await db.execute(sql`
    UPDATE investments SET updated_at = now() WHERE id = ${investmentId} RETURNING updated_at
  `)
  return new Date(res.rows[0]?.updated_at as string).toISOString()
}

export async function readInvestmentRevision(
  db: DbExecutorT,
  investmentId: number,
): Promise<string | undefined> {
  const res = await db.execute(sql`SELECT updated_at FROM investments WHERE id = ${investmentId}`)
  const value = res.rows[0]?.updated_at
  return value == null ? undefined : new Date(value as string).toISOString()
}
