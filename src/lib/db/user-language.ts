import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { toLanguage, type LanguageT } from '@/lib/i18n/languages'

export async function selectUserLanguage(
  db: DbExecutorT,
  userId: number,
): Promise<LanguageT | null> {
  const { rows } = await db.execute(sql`SELECT language FROM users WHERE id = ${userId}`)
  return toLanguage(rows[0]?.language)
}
