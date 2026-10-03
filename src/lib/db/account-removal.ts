import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { RoleT } from '@/lib/auth/roles'

export type RemovalSubjectT = {
  role: RoleT
  isTrashed: boolean
  /** Other accounts of the same role that can still log in — neither trashed nor deactivated. */
  otherLiveOfRole: number
}

export async function fetchRemovalSubject(
  db: DbExecutorT,
  userId: number,
): Promise<RemovalSubjectT | undefined> {
  const res = await db.execute(sql`
    SELECT u.role::text AS role,
      (u.trashed_at IS NOT NULL) AS is_trashed,
      (SELECT count(*)::int FROM users o
        WHERE o.role = u.role AND o.id <> u.id
          AND o.trashed_at IS NULL AND o.active IS NOT FALSE) AS other_live
    FROM users u WHERE u.id = ${userId}
  `)
  const row = res.rows[0] as { role: RoleT; is_trashed: boolean; other_live: number } | undefined
  if (!row) return undefined
  return { role: row.role, isTrashed: row.is_trashed, otherLiveOfRole: Number(row.other_live) }
}
