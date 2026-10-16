import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'

vi.mock('@/lib/leads/store-lead', () => ({ storeLead: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyNewLead: vi.fn(), sendAutoReply: vi.fn() }))

import { captureLead } from '@/lib/leads/capture-lead'
import { storeLead } from '@/lib/leads/store-lead'
import { notifyNewLead, sendAutoReply } from '@/lib/leads/notify'

const baseLead = { id: 1, email: 'jan@example.com' } as Lead
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

describe('captureLead — options', () => {
  it('skips the auto-reply on request while still notifying sales', async () => {
    await captureLead(payload, input, { autoReply: 'skip' })
    expect(sendAutoReply).not.toHaveBeenCalled()
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(dataOf()).toEqual({ notifyStatus: 'sent', autoReplyStatus: 'skipped' })
  })

  it('sends both channels when no options are given', async () => {
    await captureLead(payload, input)
    expect(notifyNewLead).toHaveBeenCalledTimes(1)
    expect(sendAutoReply).toHaveBeenCalledTimes(1)
  })

  it('forwards skipRevalidation to both the store and the status write', async () => {
    await captureLead(payload, input, { skipRevalidation: true })
    expect(storeLead).toHaveBeenCalledWith(payload, input, { skipRevalidation: true })
    expect(update.mock.calls.at(-1)?.[0]?.context).toEqual({ skipRevalidation: true })
  })

  it('defaults skipRevalidation to false so the webhook path keeps revalidating', async () => {
    await captureLead(payload, input)
    expect(storeLead).toHaveBeenCalledWith(payload, input, { skipRevalidation: false })
    expect(update.mock.calls.at(-1)?.[0]?.context).toEqual({ skipRevalidation: false })
  })
})
