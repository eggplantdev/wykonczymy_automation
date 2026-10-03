import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { DISABLED_ACCOUNT_ERROR } from '@/lib/constants/worker-lock'

// Payload writes the session row BEFORE `beforeLogin` runs and revokes it on a throw — the assertion
// on `users_sessions` is what proves no usable session survives a refused login.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PASSWORD = 'test-password-123'

describe.skipIf(!ENV_READY)('users beforeLogin — disabled accounts (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const ids: Record<'active' | 'inactive' | 'trashed', number> = {
    active: 0,
    inactive: 0,
    trashed: 0,
  }

  const emailOf = (kind: keyof typeof ids) => `refuse-login-${kind}@test.local`

  const sessionCount = async (userId: number) => {
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${userId}`,
    )
    return Number(rows[0]?.n)
  }

  const login = (kind: keyof typeof ids, password = PASSWORD) =>
    payload.login({ collection: 'users', data: { email: emailOf(kind), password } })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    for (const kind of Object.keys(ids) as (keyof typeof ids)[]) {
      const user = await payload.create({
        collection: 'users',
        data: { name: 'Konto Testowe', role: 'EMPLOYEE', email: emailOf(kind), password: PASSWORD },
        context: { skipRevalidation: true },
      })
      ids[kind] = Number(user.id)
    }
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${ids.inactive}`)
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${ids.trashed}`)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it.each(['inactive', 'trashed'] as const)(
    'refuses a %s account and leaves no session behind',
    async (kind) => {
      await expect(login(kind)).rejects.toMatchObject({ name: DISABLED_ACCOUNT_ERROR })
      expect(await sessionCount(ids[kind])).toBe(0)
    },
  )

  // The refusal must not tell a stranger the account exists: a wrong password stays the generic error.
  it('keeps the generic refusal for a wrong password on a disabled account', async () => {
    await expect(login('inactive', 'wrong-password')).rejects.toMatchObject({
      name: 'AuthenticationError',
    })
  })

  it('logs in an active account', async () => {
    const result = await login('active')
    expect(result.token).toBeTruthy()
    expect(await sessionCount(ids.active)).toBe(1)
  })
})
