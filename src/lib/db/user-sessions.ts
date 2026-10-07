import { sql } from '@payloadcms/db-vercel-postgres'
import type { RoleT } from '@/lib/auth/roles'
import type { DbExecutorT } from '@/lib/db/get-db'

/**
 * Every app request checks its token's `sid` against these rows (`isSessionAlive`), as do `/admin`
 * and REST, so this is what logs the account out.
 *
 * Call it AFTER any `payload.update` of the same user: Payload writes the whole merged document,
 * sessions array included, so an update that runs later puts the deleted rows back.
 */
export async function deleteUserSessions(db: DbExecutorT, userId: number): Promise<void> {
  await db.execute(sql`DELETE FROM users_sessions WHERE _parent_id = ${userId}`)
}

/**
 * The account state is checked alongside the `sid`, not left to the session rows alone: a row can
 * outlive its lockout. This narrows Payload's `refresh()` race but does not close it — `refresh()`
 * writes the whole user document back, `active` and `trashedAt` included, so a refresh whose read
 * precedes a deactivation and whose write follows it re-enables the account. A NULL `active`
 * predates the column's default and counts as active, as in `refuseDisabledLogin`.
 *
 * The role is matched too: the token carries it for 90 days, so a demotion has to end the session
 * rather than wait for the next slide to re-sign it.
 */
export async function isSessionAlive(
  db: DbExecutorT,
  userId: number,
  sid: string,
  role: RoleT,
): Promise<boolean> {
  const { rows } = await db.execute(sql`
    SELECT 1
    FROM users_sessions s
    JOIN users u ON u.id = s._parent_id
    WHERE s._parent_id = ${userId}
      AND s.id = ${sid}
      AND u.active IS NOT FALSE
      AND u.trashed_at IS NULL
      AND u.role = ${role}
    LIMIT 1
  `)
  return rows.length > 0
}
