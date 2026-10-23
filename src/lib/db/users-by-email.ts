import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'

export async function selectLiveUserIdsByEmails(
  db: DbExecutorT,
  emails: string[],
): Promise<number[]> {
  if (emails.length === 0) return []

  const { rows } = await db.execute(sql`
    SELECT id FROM users
    WHERE lower(email) IN (${sqlList(emails.map((email) => email.toLowerCase()))})
      AND active IS NOT FALSE
      AND trashed_at IS NULL
    ORDER BY id
  `)
  return rows.map((row) => Number(row.id))
}
