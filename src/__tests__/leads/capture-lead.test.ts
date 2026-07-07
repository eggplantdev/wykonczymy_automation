import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'

// Unit test for the store-then-notify retry contract. The store + notify seams
// are mocked; we assert the persisted notifyStatus and how many send attempts ran.
vi.mock('@/lib/leads/store-lead', () => ({ storeLead: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyNewLead: vi.fn() }))

import { captureLead } from '@/lib/leads/capture-lead'
import { storeLead } from '@/lib/leads/store-lead'
import { notifyNewLead } from '@/lib/leads/notify'

const lead = { id: 1 } as Lead
const update = vi.fn()
const payload = { update } as unknown as Payload
const input = { source: 'facebook_lead_ads', externalId: 'x' } as never

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(storeLead).mockResolvedValue({ lead, created: true })
  update.mockResolvedValue(undefined)
})

describe('captureLead — notify retry', () => {
  it('marks notifyStatus sent on first success and does not retry', async () => {
    vi.mocked(notifyNewLead).mockResolvedValue(undefined)
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { notifyStatus: 'sent' } }))
  })

  it('retries up to 3 times, then marks failed when every attempt throws', async () => {
    vi.mocked(notifyNewLead).mockRejectedValue(new Error('smtp down'))
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(3)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { notifyStatus: 'failed' } }),
    )
  })

  it('recovers on a mid-sequence success and marks sent', async () => {
    vi.mocked(notifyNewLead)
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce(undefined)
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(2)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { notifyStatus: 'sent' } }))
  })

  it('does not notify a redelivered lead (created === false)', async () => {
    vi.mocked(storeLead).mockResolvedValue({ lead, created: false })
    await captureLead(payload, input)
    expect(notifyNewLead).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })
})
