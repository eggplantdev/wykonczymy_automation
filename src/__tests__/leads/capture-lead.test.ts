import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'

// Unit test for the store-then-notify-then-autoreply contract. Store + both email
// seams are mocked; we assert the persisted notifyStatus/autoReplyStatus and how
// many send attempts ran.
vi.mock('@/lib/leads/store-lead', () => ({ storeLead: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyNewLead: vi.fn(), sendAutoReply: vi.fn() }))

import { captureLead } from '@/lib/leads/capture-lead'
import { storeLead } from '@/lib/leads/store-lead'
import { notifyNewLead, sendAutoReply } from '@/lib/leads/notify'

const baseLead = { id: 1, email: 'jan@example.com', isTest: false } as Lead
const update = vi.fn()
const payload = { update } as unknown as Payload
const input = { source: 'facebook_lead_ads', externalId: 'x' } as never

const dataOf = () => update.mock.calls.at(-1)?.[0]?.data

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(storeLead).mockResolvedValue({ lead: baseLead, created: true })
  vi.mocked(notifyNewLead).mockResolvedValue(undefined)
  vi.mocked(sendAutoReply).mockResolvedValue(undefined)
  update.mockResolvedValue(undefined)
})

describe('captureLead — notify + auto-reply', () => {
  it('sends both emails once on the happy path and marks both sent', async () => {
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(sendAutoReply).toHaveBeenCalledTimes(1)
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'sent' })
  })

  it('retries the admin notify up to 3× then marks it failed (auto-reply unaffected)', async () => {
    vi.mocked(notifyNewLead).mockRejectedValue(new Error('smtp down'))
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(3)
    expect(dataOf()).toEqual({ notifyStatus: 'failed', autoReplyStatus: 'sent' })
  })

  it('retries the auto-reply up to 3× then marks it failed (notify unaffected)', async () => {
    vi.mocked(sendAutoReply).mockRejectedValue(new Error('smtp down'))
    await captureLead(payload, input)
    expect(sendAutoReply).toHaveBeenCalledTimes(3)
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'failed' })
  })

  it('skips the auto-reply for a phone-only lead (no email)', async () => {
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 2 } as Lead, created: true })
    await captureLead(payload, input)
    expect(sendAutoReply).not.toHaveBeenCalled()
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'skipped' })
  })

  it('skips the auto-reply for a test lead but still notifies internally', async () => {
    vi.mocked(storeLead).mockResolvedValue({
      lead: { id: 3, email: 'x@test.com', isTest: true } as Lead,
      created: true,
    })
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(sendAutoReply).not.toHaveBeenCalled()
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'skipped' })
  })

  it('does nothing on a redelivery whose emails already went out (both statuses settled)', async () => {
    vi.mocked(storeLead).mockResolvedValue({
      lead: { ...baseLead, notifyStatus: 'sent', autoReplyStatus: 'sent' } as Lead,
      created: false,
    })
    await captureLead(payload, input)
    expect(notifyNewLead).not.toHaveBeenCalled()
    expect(sendAutoReply).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
  })

  // The bug: a crash between the store (writes 'pending') and the status update
  // left a row 'pending' with no email ever sent; redelivery short-circuited on
  // created===false, so it was never retried. A 'pending' channel means "never
  // attempted" — retry it; a settled channel ('sent'/'failed'/'skipped') is left alone.
  it('retries a pending channel on redelivery (crashed before the first send)', async () => {
    vi.mocked(storeLead).mockResolvedValue({
      lead: { ...baseLead, notifyStatus: 'pending', autoReplyStatus: 'pending' } as Lead,
      created: false,
    })
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(sendAutoReply).toHaveBeenCalledTimes(1)
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'sent' })
  })

  it('retries only the still-pending channel, never re-sending the settled one', async () => {
    vi.mocked(storeLead).mockResolvedValue({
      lead: { ...baseLead, notifyStatus: 'sent', autoReplyStatus: 'pending' } as Lead,
      created: false,
    })
    await captureLead(payload, input)
    expect(notifyNewLead).not.toHaveBeenCalled()
    expect(sendAutoReply).toHaveBeenCalledTimes(1)
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'sent' })
  })
})
