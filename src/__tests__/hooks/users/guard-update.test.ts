import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('users beforeChange — trashed account freeze (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let workerId: number

  const nameOf = async () => {
    const { rows } = await db.execute(sql`SELECT name FROM users WHERE id = ${workerId}`)
    return rows[0]?.name
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
          data: {
            name: 'Pracownik W Koszu',
            role: 'EMPLOYEE',
            email: 'users-update-guard@test.local',
            password: 'test-password-123',
          },
          context: { skipRevalidation: true },
        })
      ).id,
    )
    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${workerId}`)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('refuses editing a trashed worker', async () => {
    await expect(
      payload.update({
        collection: 'users',
        id: workerId,
        data: { name: 'Zmieniony' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    ).rejects.toThrow(/w koszu/)

    expect(await nameOf()).toBe('Pracownik W Koszu')
  })

  it('allows the restore, after which edits go through again', async () => {
    await payload.update({
      collection: 'users',
      id: workerId,
      data: { trashedAt: null },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    await payload.update({
      collection: 'users',
      id: workerId,
      data: { name: 'Przywrócony' },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })

    const { rows } = await db.execute(sql`SELECT trashed_at FROM users WHERE id = ${workerId}`)
    expect(rows[0]?.trashed_at).toBeNull()
    expect(await nameOf()).toBe('Przywrócony')
  })
})
