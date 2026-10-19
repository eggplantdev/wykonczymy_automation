import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import type { RoleT } from '@/lib/auth/roles'
import type { getDb } from '@/lib/db/get-db'

const FIXTURE_EMAIL_PATTERN = '%@test.local'

// The email must end in `@test.local`, or `purgeFixtureUsers` never removes the account.
export async function createTestUser(
  payload: Payload,
  {
    email,
    name = email,
    role = 'EMPLOYEE',
    password = 'test-password-123',
  }: { email: string; name?: string; role?: RoleT; password?: string },
): Promise<number> {
  const user = await payload.create({
    collection: 'users',
    data: { name, role, email, password },
    overrideAccess: true,
    context: { skipRevalidation: true },
  })
  return Number(user.id)
}

// A snapshot's `taken_by` FK-references users(id), and a prod-dump test DB may have no user 1.
export async function firstUserId(
  payload: Payload,
  { role }: { role?: RoleT } = {},
): Promise<number> {
  const users = await payload.find({
    collection: 'users',
    where: {
      trashedAt: { exists: false },
      ...(role ? { role: { equals: role } } : {}),
    },
    limit: 1,
    sort: 'id',
    depth: 0,
    overrideAccess: true,
  })
  const firstUser = users.docs[0]
  if (!firstUser) throw new Error('no user in the DB to attribute the action to')
  return Number(firstUser.id)
}

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
