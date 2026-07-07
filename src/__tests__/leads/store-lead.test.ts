import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from '@/lib/leads/store-lead'

// Pure unit test of the idempotency + concurrent-race handling. payload.find /
// payload.create are mocked; the DB-backed variant lives in store-lead.db.test.ts.
const find = vi.fn()
const create = vi.fn()
const payload = { find, create } as unknown as Payload

const input: StoreLeadInputT = {
  source: 'facebook_lead_ads',
  externalId: 'lead-1',
  rawData: [],
  isTest: false,
}

const asFind = (docs: Lead[]) => ({ docs })
const winner = { id: 7 } as Lead

beforeEach(() => {
  vi.clearAllMocks()
})

describe('storeLead — idempotency & race', () => {
  it('creates when no sibling exists', async () => {
    find.mockResolvedValueOnce(asFind([]))
    create.mockResolvedValueOnce({ id: 1 } as Lead)
    const result = await storeLead(payload, input)
    expect(result.created).toBe(true)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('returns the existing sibling without creating (redelivery)', async () => {
    find.mockResolvedValueOnce(asFind([winner]))
    const result = await storeLead(payload, input)
    expect(result).toEqual({ lead: winner, created: false })
    expect(create).not.toHaveBeenCalled()
  })

  it('recovers from a lost unique-index race: create throws, the winner is re-read', async () => {
    find.mockResolvedValueOnce(asFind([])) // initial lookup: not there yet
    create.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'))
    find.mockResolvedValueOnce(asFind([winner])) // post-catch: the concurrent winner
    const result = await storeLead(payload, input)
    expect(result).toEqual({ lead: winner, created: false })
  })

  it('rethrows a genuine create failure (row still absent after the catch)', async () => {
    find.mockResolvedValueOnce(asFind([]))
    create.mockRejectedValueOnce(new Error('db connection dropped'))
    find.mockResolvedValueOnce(asFind([]))
    await expect(storeLead(payload, input)).rejects.toThrow('db connection dropped')
  })
})
