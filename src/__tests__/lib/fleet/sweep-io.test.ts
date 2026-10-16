import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { stampNotified } from '@/lib/fleet/sweep-io'
import type { StampT } from '@/lib/fleet/reminder-sweep'

const SENT_AT = new Date('2026-08-25T09:00:00.000Z')

const stamp = (inspectionId: number, extra: Partial<StampT> = {}): StampT =>
  ({ inspectionId, threshold: 30, odometer: false, ...extra }) as StampT

function fakePayload() {
  const updates: { id: number; data: Record<string, unknown> }[] = []
  const payload = {
    update: vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => {
      updates.push({ id, data })
    }),
  }
  return { payload: payload as unknown as Payload, updates }
}

describe('stampNotified', () => {
  it('stamps every row and reports nothing failed', async () => {
    const { payload, updates } = fakePayload()

    const failed = await stampNotified(payload, [stamp(1), stamp(2), stamp(3)], SENT_AT)

    expect(failed).toEqual([])
    expect(updates.map(({ id }) => id)).toEqual([1, 2, 3])
    expect(updates[0].data).toEqual({ notifiedThreshold: 30, notifiedAt: SENT_AT.toISOString() })
  })

  it('returns the ids that failed and stamps the rest', async () => {
    const { payload, updates } = fakePayload()
    vi.mocked(payload.update).mockImplementationOnce(async () => {
      throw new Error('db down')
    })

    const failed = await stampNotified(payload, [stamp(1), stamp(2)], SENT_AT)

    expect(failed).toEqual([1])
    expect(updates.map(({ id }) => id)).toEqual([2])
  })

  // The deployed database keeps one of a set of concurrent Payload writes, drops the rest and
  // reports success for all of them — a mock cannot show the dropped row itself.
  it('never has two stamps in flight at once', async () => {
    const { payload, updates } = fakePayload()
    let inFlight = 0
    let maxInFlight = 0
    vi.mocked(payload.update).mockImplementation((async ({ id }: { id: number }) => {
      inFlight += 1
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 5))
      inFlight -= 1
      updates.push({ id, data: {} })
    }) as unknown as Payload['update'])

    await stampNotified(payload, [stamp(1), stamp(2), stamp(3), stamp(4)], SENT_AT)

    expect(maxInFlight).toBe(1)
    expect(updates.map(({ id }) => id)).toEqual([1, 2, 3, 4])
  })
})
