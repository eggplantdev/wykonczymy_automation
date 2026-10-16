import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  deletePushSubscription,
  deletePushSubscriptionByEndpoint,
  selectLivePushSubscriptions,
  upsertPushSubscription,
} from '@/lib/db/push-subscriptions'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const PHONE = 'https://push.test.local/phone'
const TABLET = 'https://push.test.local/tablet'

const device = (endpoint: string) => ({
  endpoint,
  p256dh: `p256dh-${endpoint}`,
  auth: `auth-${endpoint}`,
  userAgent: 'vitest',
})

describe.skipIf(!ENV_READY)('push subscriptions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let otherId: number

  const createWorker = async (email: string) =>
    Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: email, role: 'EMPLOYEE', email, password: 'test-password-123' },
          context: { skipRevalidation: true },
        })
      ).id,
    )

  const endpointsOf = async (userId: number) =>
    (await selectLivePushSubscriptions(db, userId)).map((row) => row.endpoint).sort()

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    ownerId = await createWorker('push-owner@test.local')
    otherId = await createWorker('push-other@test.local')
  })

  beforeEach(async () => {
    await db.execute(sql`DELETE FROM push_subscriptions WHERE user_id IN (${ownerId}, ${otherId})`)
    await db.execute(
      sql`UPDATE users SET active = true, trashed_at = NULL WHERE id IN (${ownerId}, ${otherId})`,
    )
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('selects every device of a live account', async () => {
    await upsertPushSubscription(db, ownerId, device(PHONE))
    await upsertPushSubscription(db, ownerId, device(TABLET))

    expect(await endpointsOf(ownerId)).toEqual([PHONE, TABLET])
  })

  it('moves a device to whoever subscribed on it last', async () => {
    await upsertPushSubscription(db, ownerId, device(PHONE))
    await upsertPushSubscription(db, otherId, { ...device(PHONE), auth: 'rotated' })

    expect(await endpointsOf(ownerId)).toEqual([])
    expect(await selectLivePushSubscriptions(db, otherId)).toEqual([
      { endpoint: PHONE, p256dh: `p256dh-${PHONE}`, auth: 'rotated' },
    ])
  })

  it.each([
    ['deactivated', sql`active = false`],
    ['trashed', sql`trashed_at = now()`],
  ])('selects nothing for a %s account whose rows survived', async (_label, lockout) => {
    await upsertPushSubscription(db, ownerId, device(PHONE))
    await db.execute(sql`UPDATE users SET ${lockout} WHERE id = ${ownerId}`)

    expect(await endpointsOf(ownerId)).toEqual([])
  })

  it('removes a device only for the account that owns it', async () => {
    await upsertPushSubscription(db, ownerId, device(PHONE))

    await deletePushSubscription(db, otherId, PHONE)
    expect(await endpointsOf(ownerId)).toEqual([PHONE])

    await deletePushSubscription(db, ownerId, PHONE)
    expect(await endpointsOf(ownerId)).toEqual([])
  })

  it('removes a gone endpoint whoever owns it', async () => {
    await upsertPushSubscription(db, ownerId, device(PHONE))
    await upsertPushSubscription(db, ownerId, device(TABLET))

    await deletePushSubscriptionByEndpoint(db, PHONE)

    expect(await endpointsOf(ownerId)).toEqual([TABLET])
  })
})
