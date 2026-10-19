import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn().mockResolvedValue({}),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'user-agent': 'iPhone Safari' }),
}))

const db = { tag: 'db' }
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => db) }))

const upsertPushSubscription = vi.fn()
const deletePushSubscription = vi.fn()
vi.mock('@/lib/db/push-subscriptions', () => ({
  upsertPushSubscription: (...args: unknown[]) => upsertPushSubscription(...args),
  deletePushSubscription: (...args: unknown[]) => deletePushSubscription(...args),
}))

const { subscribePushAction, unsubscribePushAction } = await import('@/lib/actions/push')

const WORKER_ID = 7
const PHONE = 'https://push.test.local/phone'
const subscription = { endpoint: PHONE, keys: { p256dh: 'p256dh', auth: 'auth' } }

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  authState.userId = WORKER_ID
  authState.role = 'EMPLOYEE'
  upsertPushSubscription.mockReset()
  deletePushSubscription.mockReset()
})

describe('subscribePushAction', () => {
  it('registers the device for the session account', async () => {
    expect(await subscribePushAction(subscription)).toEqual({ success: true })
    expect(upsertPushSubscription).toHaveBeenCalledExactlyOnceWith(db, WORKER_ID, {
      endpoint: PHONE,
      p256dh: 'p256dh',
      auth: 'auth',
      userAgent: 'iPhone Safari',
    })
  })

  it.each(['http://push.test.local/phone', 'not a url', `${PHONE}/${'x'.repeat(2048)}`])(
    'refuses an endpoint no push service hands out (%#)',
    async (endpoint) => {
      const result = await subscribePushAction({ ...subscription, endpoint })

      expect(result.success).toBe(false)
      expect(upsertPushSubscription).not.toHaveBeenCalled()
    },
  )

  it('refuses a caller without a session', async () => {
    vi.mocked(getCurrentUserJwt).mockResolvedValueOnce(undefined)

    expect((await subscribePushAction(subscription)).success).toBe(false)
    expect(upsertPushSubscription).not.toHaveBeenCalled()
  })
})

describe('unsubscribePushAction', () => {
  it('removes the device only from the session account', async () => {
    expect(await unsubscribePushAction(PHONE)).toEqual({ success: true })
    expect(deletePushSubscription).toHaveBeenCalledExactlyOnceWith(db, WORKER_ID, PHONE)
  })
})
