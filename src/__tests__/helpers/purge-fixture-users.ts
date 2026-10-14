import { sql } from '@payloadcms/db-postgres'
import type { getDb } from '@/lib/db/get-db'

/**
 * The `@test.local` namespace every DB spec's fixture users live in. Nothing real is ever
 * addressed here, so anything matching it is by definition a leftover.
 */
const FIXTURE_EMAIL_PATTERN = '%@test.local'

/**
 * Clear the fixture-user namespace BEFORE a spec creates its own.
 *
 * These specs create users with fixed emails and delete them in `afterAll`, which works
 * right up until something throws in between — then the rows survive, `email` is unique,
 * and every later run dies in `beforeAll` with Payload's `ValidationError: The following
 * field is invalid: email`. That message names neither the duplicate nor the collision, so
 * the wedge reads like a code bug and stays wedged until someone deletes rows by hand.
 *
 * Cleanup that runs on ENTRY is what makes a shared-DB spec restartable: `afterAll` only
 * runs when the run got that far, and the run that didn't is exactly the one that left the
 * mess. Registers go first — `cash_registers.owner_id` is NOT NULL, so Postgres cannot
 * null it out on the user delete and refuses the whole statement instead.
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
