import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { isSessionAlive } from '@/lib/db/user-sessions'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const EMAIL = 'session-alive@test.local'
const PASSWORD = 'test-password-123'

describe.skipIf(!ENV_READY)('isSessionAlive (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let userId: number
  let sid: string

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    userId = Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: 'Konto Sesji', role: 'EMPLOYEE', email: EMAIL, password: PASSWORD },
          context: { skipRevalidation: true },
        })
      ).id,
    )
  })

  beforeEach(async () => {
    await db.execute(
      sql`UPDATE users SET active = true, trashed_at = NULL WHERE id = ${userId}`,
    )
    await payload.login({ collection: 'users', data: { email: EMAIL, password: PASSWORD } })
    const { rows } = await db.execute(
      sql`SELECT id FROM users_sessions WHERE _parent_id = ${userId} ORDER BY created_at DESC LIMIT 1`,
    )
    sid = String(rows[0]?.id)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('is alive for a stored session of an active account', async () => {
    expect(await isSessionAlive(db, userId, sid)).toBe(true)
  })

  it('is alive when `active` is NULL — a row older than the column’s default', async () => {
    await db.execute(sql`UPDATE users SET active = NULL WHERE id = ${userId}`)

    expect(await isSessionAlive(db, userId, sid)).toBe(true)
  })

  it('is dead once the session row is gone', async () => {
    await db.execute(sql`DELETE FROM users_sessions WHERE id = ${sid}`)

    expect(await isSessionAlive(db, userId, sid)).toBe(false)
  })

  it('is dead for a deactivated account even while the row survives', async () => {
    await db.execute(sql`UPDATE users SET active = false WHERE id = ${userId}`)

    expect(await isSessionAlive(db, userId, sid)).toBe(false)
  })

  it('is dead for a trashed account even while the row survives', async () => {
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${userId}`)

    expect(await isSessionAlive(db, userId, sid)).toBe(false)
  })

  it('is dead for a `sid` presented under another account’s id', async () => {
    expect(await isSessionAlive(db, userId + 1_000_000, sid)).toBe(false)
  })
})
