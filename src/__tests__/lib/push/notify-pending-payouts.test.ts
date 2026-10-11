import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { PushMessageT } from '@/lib/push/send-push'

vi.mock('server-only', () => ({}))

const { sendPushToUser, isPushConfigured, countPendingPayouts } = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
  isPushConfigured: vi.fn(),
  countPendingPayouts: vi.fn(),
}))
vi.mock('@/lib/push/send-push', () => ({ sendPushToUser, isPushConfigured }))
vi.mock('@/lib/db/payout-confirmation', () => ({ countPendingPayouts }))

import { notifyPendingPayouts } from '@/lib/push/notify-pending-payouts'

const db = {} as DbExecutorT

const messageTo = (workerId: number): PushMessageT => {
  const call = sendPushToUser.mock.calls.find(([, userId]) => userId === workerId)
  if (!call) throw new Error(`no push to worker ${workerId}`)
  return (call[2] as (locale: 'pl') => PushMessageT)('pl')
}

describe('notifyPendingPayouts', () => {
  beforeEach(() => {
    sendPushToUser.mockReset().mockResolvedValue(1)
    isPushConfigured.mockReset().mockReturnValue(true)
    countPendingPayouts.mockReset().mockResolvedValue(2)
  })

  it('sends one push for two wypłaty booked to one worker, with the stored count on the badge', async () => {
    await notifyPendingPayouts(db, [
      { workerId: 7, amount: 300 },
      { workerId: 7, amount: 200 },
    ])

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(countPendingPayouts).toHaveBeenCalledWith(db, 7)
    expect(messageTo(7)).toMatchObject({
      tag: 'payout-pending',
      url: '/pracownicy/7',
      badgeCount: 2,
    })
    expect(messageTo(7).body).toMatch(/500,00/)
  })

  it('sends one push per worker when a booking covers two', async () => {
    await notifyPendingPayouts(db, [
      { workerId: 7, amount: 300 },
      { workerId: 9, amount: 100 },
    ])

    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(messageTo(9).url).toBe('/pracownicy/9')
  })

  it('reads nothing and sends nothing without the production keys', async () => {
    isPushConfigured.mockReturnValue(false)

    await notifyPendingPayouts(db, [{ workerId: 7, amount: 300 }])

    expect(countPendingPayouts).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('still notifies the other worker when one count fails', async () => {
    countPendingPayouts.mockImplementation(async (_db, workerId: number) => {
      if (workerId === 7) throw new Error('db down')
      return 1
    })

    await expect(
      notifyPendingPayouts(db, [
        { workerId: 7, amount: 300 },
        { workerId: 9, amount: 100 },
      ]),
    ).resolves.toBeUndefined()
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(messageTo(9).badgeCount).toBe(1)
  })
})
