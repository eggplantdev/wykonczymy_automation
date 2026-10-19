import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

// The last-OWNER / last-ADMIN refusal itself is pinned in `lib/workers/account-removal.test.ts`: the
// test DB is a prod dump, so real owners always outnumber a fixture.
describe.skipIf(!ENV_READY)('users beforeDelete guard — account removal (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let otherOwnerId: number

  const createOwner = (email: string) =>
    createTestUser(payload, { name: 'Właściciel Testowy', email, role: 'OWNER' })

  const otherLiveOwners = async () => {
    const { fetchRemovalSubject } = await import('@/lib/db/account-removal')
    return (await fetchRemovalSubject(db, ownerId))?.otherLiveOfRole
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    ownerId = await createOwner('users-delete-guard-owner@test.local')
    otherOwnerId = await createOwner('users-delete-guard-owner-2@test.local')
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('refuses deleting your own account', async () => {
    const self = await payload.findByID({ collection: 'users', id: ownerId })

    await expect(
      payload.delete({
        collection: 'users',
        id: ownerId,
        user: { ...self, collection: 'users' },
        overrideAccess: true,
        context: { skipRevalidation: true },
      }),
    ).rejects.toThrow(/własnego konta/)

    const { rows } = await db.execute(sql`SELECT 1 FROM users WHERE id = ${ownerId}`)
    expect(rows).toHaveLength(1)
  })

  it('stops counting another OWNER once trashed or deactivated', async () => {
    const live = await otherLiveOwners()

    await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${otherOwnerId}`)
    expect(await otherLiveOwners()).toBe(Number(live) - 1)

    await db.execute(
      sql`UPDATE users SET trashed_at = NULL, active = false WHERE id = ${otherOwnerId}`,
    )
    expect(await otherLiveOwners()).toBe(Number(live) - 1)

    await db.execute(sql`UPDATE users SET active = true WHERE id = ${otherOwnerId}`)
    expect(await otherLiveOwners()).toBe(live)
  })
})
