import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { PushMessageT } from '@/lib/push/send-push'

vi.mock('server-only', () => ({}))

const keys = vi.hoisted(() => ({ publicKey: 'public-key' as string | undefined }))
vi.mock('@/lib/env', () => ({
  FRONTEND_URL: 'https://app.test.local',
  get VAPID_PUBLIC_KEY() {
    return keys.publicKey
  },
}))

const sendNotification = vi.fn()
vi.mock('web-push', () => ({
  sendNotification: (...args: unknown[]) => sendNotification(...args),
}))

const selectLivePushSubscriptions = vi.fn()
const deletePushSubscriptionByEndpoint = vi.fn()
vi.mock('@/lib/db/push-subscriptions', () => ({
  selectLivePushSubscriptions: (...args: unknown[]) => selectLivePushSubscriptions(...args),
  deletePushSubscriptionByEndpoint: (...args: unknown[]) =>
    deletePushSubscriptionByEndpoint(...args),
}))

const selectUserLanguage = vi.fn()
vi.mock('@/lib/db/user-language', () => ({
  selectUserLanguage: (...args: unknown[]) => selectUserLanguage(...args),
}))

const { sendPushToUser } = await import('@/lib/push/send-push')

const db = {} as DbExecutorT
const PHONE = 'https://push.test.local/phone'
const TABLET = 'https://push.test.local/tablet'
const device = (endpoint: string) => ({ endpoint, p256dh: 'p256dh', auth: 'auth' })
const refusal = (statusCode: number) => Object.assign(new Error('refused'), { statusCode })
const build = (locale: string): PushMessageT => ({
  title: `title-${locale}`,
  body: 'body',
  url: '/',
  tag: 'test',
})

beforeEach(() => {
  keys.publicKey = 'public-key'
  vi.stubEnv('VAPID_PRIVATE_KEY', 'private-key')
  vi.spyOn(console, 'error').mockImplementation(() => {})
  sendNotification.mockReset().mockResolvedValue({ statusCode: 201 })
  selectLivePushSubscriptions.mockReset().mockResolvedValue([device(PHONE), device(TABLET)])
  deletePushSubscriptionByEndpoint.mockReset().mockResolvedValue(undefined)
  selectUserLanguage.mockReset().mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('sendPushToUser', () => {
  it.each([
    ['public', () => (keys.publicKey = undefined)],
    ['private', () => vi.stubEnv('VAPID_PRIVATE_KEY', undefined)],
  ])('sends nothing without the %s key', async (_label, dropKey) => {
    dropKey()

    expect(await sendPushToUser(db, 1, build)).toBe(0)
    expect(selectLivePushSubscriptions).not.toHaveBeenCalled()
    expect(sendNotification).not.toHaveBeenCalled()
  })

  it.each([404, 410])('forgets a device the push service reports gone (%i)', async (status) => {
    sendNotification.mockRejectedValueOnce(refusal(status))

    expect(await sendPushToUser(db, 1, build)).toBe(1)
    expect(deletePushSubscriptionByEndpoint).toHaveBeenCalledExactlyOnceWith(db, PHONE)
  })

  it('still counts the sends when forgetting a gone device fails', async () => {
    sendNotification.mockRejectedValueOnce(refusal(410))
    deletePushSubscriptionByEndpoint.mockRejectedValue(new Error('db down'))

    expect(await sendPushToUser(db, 1, build)).toBe(1)
  })

  it.each([401, 403, 500])(
    'keeps a device when the refusal is not about it (%i)',
    async (status) => {
      sendNotification.mockRejectedValue(refusal(status))

      expect(await sendPushToUser(db, 1, build)).toBe(0)
      expect(deletePushSubscriptionByEndpoint).not.toHaveBeenCalled()
    },
  )

  it('still reaches the other devices when one fails', async () => {
    sendNotification.mockRejectedValueOnce(new Error('network down'))

    expect(await sendPushToUser(db, 1, build)).toBe(1)
    expect(sendNotification).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['uk', 'uk'],
    [null, 'pl'],
  ])('builds the text in the account language (%s → %s)', async (stored, expected) => {
    selectUserLanguage.mockResolvedValue(stored)

    await sendPushToUser(db, 1, build)

    const payload = JSON.parse(sendNotification.mock.calls[0][1])
    expect(payload.title).toBe(`title-${expected}`)
    expect(sendNotification.mock.calls[0][2]).toMatchObject({ topic: 'test' })
  })

  it('never throws to its caller', async () => {
    selectLivePushSubscriptions.mockRejectedValue(new Error('db down'))

    await expect(sendPushToUser(db, 1, build)).resolves.toBe(0)
  })
})
