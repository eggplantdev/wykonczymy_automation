import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const subscribePushAction = vi.fn()
const unsubscribePushAction = vi.fn()
vi.mock('@/lib/actions/push', () => ({
  subscribePushAction: (...args: unknown[]) => subscribePushAction(...args),
  unsubscribePushAction: (...args: unknown[]) => unsubscribePushAction(...args),
}))

const { syncPushSubscription, unsubscribeThisDevice } = await import('@/lib/pwa/push-client')

// base64url of bytes [1, 2, 3, 4]
const OUR_KEY = 'AQIDBA'
const OTHER_KEY = 'BQYHCA'
const ENDPOINT = 'https://push.test.local/phone'

const keyBytes = (base64Url: string) =>
  Uint8Array.from(atob(base64Url.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    .buffer

const fakeSubscription = (signedWith: string) => ({
  endpoint: ENDPOINT,
  options: { applicationServerKey: keyBytes(signedWith) },
  toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256dh', auth: 'auth' } }),
  unsubscribe: vi.fn().mockResolvedValue(true),
})

const installBrowser = ({
  permission = 'granted',
  subscription,
  registered = true,
}: {
  permission?: NotificationPermission
  subscription?: ReturnType<typeof fakeSubscription>
  registered?: boolean
}) => {
  vi.stubGlobal('Notification', { permission })
  vi.stubGlobal('window', { PushManager: class {}, Notification: {} })
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistration: vi.fn(async () =>
        registered
          ? { pushManager: { getSubscription: async () => subscription ?? null } }
          : undefined,
      ),
    },
  })
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  subscribePushAction.mockReset().mockResolvedValue({ success: true })
  unsubscribePushAction.mockReset().mockResolvedValue({ success: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('syncPushSubscription', () => {
  it('re-registers a device subscribed with our key', async () => {
    installBrowser({ subscription: fakeSubscription(OUR_KEY) })

    expect(await syncPushSubscription(OUR_KEY)).toBe(true)
    expect(subscribePushAction).toHaveBeenCalledExactlyOnceWith({
      endpoint: ENDPOINT,
      keys: { p256dh: 'p256dh', auth: 'auth' },
    })
  })

  it('drops a subscription signed for another key pair without resubscribing', async () => {
    const subscription = fakeSubscription(OTHER_KEY)
    installBrowser({ subscription })

    expect(await syncPushSubscription(OUR_KEY)).toBe(false)
    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(subscribePushAction).not.toHaveBeenCalled()
  })

  it.each(['default', 'denied'] as const)(
    'touches nothing while the permission is %s',
    async (permission) => {
      installBrowser({ permission, subscription: fakeSubscription(OUR_KEY) })

      expect(await syncPushSubscription(OUR_KEY)).toBe(false)
      expect(navigator.serviceWorker.getRegistration).not.toHaveBeenCalled()
      expect(subscribePushAction).not.toHaveBeenCalled()
    },
  )
})

describe('unsubscribeThisDevice', () => {
  it('forgets the device in the browser and on the server', async () => {
    const subscription = fakeSubscription(OUR_KEY)
    installBrowser({ subscription })

    await unsubscribeThisDevice()

    expect(subscription.unsubscribe).toHaveBeenCalledOnce()
    expect(unsubscribePushAction).toHaveBeenCalledExactlyOnceWith(ENDPOINT)
  })

  it('still forgets the device on the server when the browser unsubscribe throws', async () => {
    const subscription = fakeSubscription(OUR_KEY)
    subscription.unsubscribe.mockRejectedValue(new Error('InvalidStateError'))
    installBrowser({ subscription })

    await expect(unsubscribeThisDevice()).resolves.toBeUndefined()
    expect(unsubscribePushAction).toHaveBeenCalledExactlyOnceWith(ENDPOINT)
  })

  it('settles at once when no service worker is registered', async () => {
    installBrowser({ registered: false })

    await expect(unsubscribeThisDevice()).resolves.toBeUndefined()
    expect(unsubscribePushAction).not.toHaveBeenCalled()
  })

  it('never throws, so the logout behind it still runs', async () => {
    installBrowser({ subscription: fakeSubscription(OUR_KEY) })
    unsubscribePushAction.mockRejectedValue(new Error('offline'))

    await expect(unsubscribeThisDevice()).resolves.toBeUndefined()
  })
})
