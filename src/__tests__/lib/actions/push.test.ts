import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@payload-config', () => ({ default: {} }))

const mockRequireAuth = vi.fn()
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}))

vi.mock('payload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('payload')>()),
  getPayload: vi.fn().mockResolvedValue({}),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
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

const worker = { id: 7, email: 'w@test.local', name: 'Worker', role: 'EMPLOYEE' as const }
const PHONE = 'https://push.test.local/phone'
const subscription = { endpoint: PHONE, keys: { p256dh: 'p256dh', auth: 'auth' } }

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
  mockRequireAuth.mockReset().mockResolvedValue({ success: true, user: worker })
  upsertPushSubscription.mockReset()
  deletePushSubscription.mockReset()
})

describe('subscribePushAction', () => {
  it('registers the device for the session account', async () => {
    expect(await subscribePushAction(subscription)).toEqual({ success: true })
    expect(upsertPushSubscription).toHaveBeenCalledExactlyOnceWith(db, worker.id, {
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
    mockRequireAuth.mockResolvedValue({ success: false, error: 'Brak sesji' })

    expect((await subscribePushAction(subscription)).success).toBe(false)
    expect(upsertPushSubscription).not.toHaveBeenCalled()
  })
})

describe('unsubscribePushAction', () => {
  it('removes the device only from the session account', async () => {
    expect(await unsubscribePushAction(PHONE)).toEqual({ success: true })
    expect(deletePushSubscription).toHaveBeenCalledExactlyOnceWith(db, worker.id, PHONE)
  })
})
