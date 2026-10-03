import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

/**
 * Ends every stored session of one account, which is what `/admin` and REST check a token's `sid`
 * against. The app's own reads are JWT-only and ignore it, so an open app session lasts until expiry.
 *
 * Call it AFTER any `payload.update` of the same user: Payload writes the whole merged document,
 * sessions array included, so an update that runs later puts the deleted rows back.
 */
export async function deleteUserSessions(db: DbExecutorT, userId: number): Promise<void> {
  await db.execute(sql`DELETE FROM users_sessions WHERE _parent_id = ${userId}`)
}
