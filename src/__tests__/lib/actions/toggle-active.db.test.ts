import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// Real `payload.update`, because the update rewrites the sessions array from the merged doc — a
// delete ordered before it would be undone, and only the persisted rows show that.

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: 'OWNER', name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const EMAIL = 'toggle-active-sessions@test.local'
const PASSWORD = 'test-password-123'

describe.skipIf(!ENV_READY)('toggleUserActive — sessions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number

  const sessionCount = async () => {
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${workerId}`,
    )
    return Number(rows[0]?.n)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    workerId = Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: 'Konto Sesji', role: 'EMPLOYEE', email: EMAIL, password: PASSWORD },
          context: { skipRevalidation: true },
        })
      ).id,
    )
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('drops every stored session when the account is deactivated', async () => {
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })
    expect(await sessionCount()).toBe(2)

    const { toggleUserActive } = await import('@/lib/actions/toggle-active')
    expect(await toggleUserActive(workerId, false)).toEqual({ success: true })

    expect(await sessionCount()).toBe(0)
    const { rows } = await db.execute(sql`SELECT active FROM users WHERE id = ${workerId}`)
    expect(rows[0]?.active).toBe(false)
  })

  it('keeps sessions when the account is activated', async () => {
    await db.execute(sql`UPDATE users SET active = true WHERE id = ${workerId}`)
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })

    const { toggleUserActive } = await import('@/lib/actions/toggle-active')
    expect(await toggleUserActive(workerId, true)).toEqual({ success: true })

    expect(await sessionCount()).toBe(1)
  })
})
