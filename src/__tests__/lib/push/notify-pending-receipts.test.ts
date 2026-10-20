import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DbExecutorT } from '@/lib/db/get-db'
import type { PushMessageT } from '@/lib/push/send-push'

const { sendPushToUser, isPushConfigured, countPendingReceipts } = vi.hoisted(() => ({
  sendPushToUser: vi.fn(),
  isPushConfigured: vi.fn(),
  countPendingReceipts: vi.fn(),
}))
vi.mock('@/lib/push/send-push', () => ({ sendPushToUser, isPushConfigured }))
vi.mock('@/lib/db/receipt-confirmation', () => ({ countPendingReceipts }))
vi.mock('@/lib/push/constants', () => ({ RECEIPT_PUSH_PAUSED: false }))

import { notifyPendingReceipts } from '@/lib/push/notify-pending-receipts'

const db = {} as DbExecutorT

const messageTo = (recipientId: number): PushMessageT => {
  const call = sendPushToUser.mock.calls.find(([, userId]) => userId === recipientId)
  if (!call) throw new Error(`no push to recipient ${recipientId}`)
  return (call[2] as (locale: 'pl') => PushMessageT)('pl')
}

describe('notifyPendingReceipts', () => {
  beforeEach(() => {
    sendPushToUser.mockReset().mockResolvedValue(1)
    isPushConfigured.mockReset().mockReturnValue(true)
    countPendingReceipts.mockReset().mockResolvedValue(2)
  })

  it('sends one push for two wypłaty booked to one worker, with the stored count on the badge', async () => {
    await notifyPendingReceipts(db, [
      { recipientId: 7, amount: 300 },
      { recipientId: 7, amount: 200 },
    ])

    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(countPendingReceipts).toHaveBeenCalledWith(db, 7)
    expect(messageTo(7)).toMatchObject({
      tag: 'payout-pending',
      url: '/pracownicy/7',
      badgeCount: 2,
    })
    expect(messageTo(7).body).toMatch(/500,00/)
  })

  it('sends one push per worker when a booking covers two', async () => {
    await notifyPendingReceipts(db, [
      { recipientId: 7, amount: 300 },
      { recipientId: 9, amount: 100 },
    ])

    expect(sendPushToUser).toHaveBeenCalledTimes(2)
    expect(messageTo(9).url).toBe('/pracownicy/9')
  })

  it('reads nothing and sends nothing without the production keys', async () => {
    isPushConfigured.mockReturnValue(false)

    await notifyPendingReceipts(db, [{ recipientId: 7, amount: 300 }])

    expect(countPendingReceipts).not.toHaveBeenCalled()
    expect(sendPushToUser).not.toHaveBeenCalled()
  })

  it('still notifies the other worker when one count fails', async () => {
    countPendingReceipts.mockImplementation(async (_db, recipientId: number) => {
      if (recipientId === 7) throw new Error('db down')
      return 1
    })

    await expect(
      notifyPendingReceipts(db, [
        { recipientId: 7, amount: 300 },
        { recipientId: 9, amount: 100 },
      ]),
    ).resolves.toBeUndefined()
    expect(sendPushToUser).toHaveBeenCalledTimes(1)
    expect(messageTo(9).badgeCount).toBe(1)
  })
})
