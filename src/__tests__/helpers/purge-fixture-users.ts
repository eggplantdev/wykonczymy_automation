import { sql } from '@payloadcms/db-postgres'
import type { getDb } from '@/lib/db/get-db'

const FIXTURE_EMAIL_PATTERN = '%@test.local'

/**
 * Registers go first — `cash_registers.owner_id` is NOT NULL, so Postgres cannot null it out
 * on the user delete and refuses the whole statement instead.
 */
export async function purgeFixtureUsers(db: Awaited<ReturnType<typeof getDb>>): Promise<void> {
  const doomedUsers = sql`SELECT id FROM users WHERE email LIKE ${FIXTURE_EMAIL_PATTERN}`
  const doomedRegisters = sql`SELECT id FROM cash_registers WHERE owner_id IN (${doomedUsers})`

  await db.execute(sql`
    DELETE FROM transactions
    WHERE worker_id IN (${doomedUsers})
       OR source_register_id IN (${doomedRegisters})
       OR target_register_id IN (${doomedRegisters})
  `)
  await db.execute(sql`DELETE FROM cash_registers WHERE owner_id IN (${doomedUsers})`)
  await db.execute(sql`DELETE FROM users WHERE email LIKE ${FIXTURE_EMAIL_PATTERN}`)
}
