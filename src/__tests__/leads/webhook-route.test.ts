import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Route-handler unit test. We drive POST directly with a stub request and mock the
// network/DB/notify seams, keeping lead-schema + normalize-lead real. The contract
// under test: which failures make Meta retry (non-200) vs ack (200).
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/lib/leads/verify-signature', () => ({ verifySignature: vi.fn(() => true) }))
vi.mock('@/lib/leads/fetch-lead', () => ({ fetchLead: vi.fn() }))
vi.mock('@/lib/leads/capture-lead', () => ({ captureLead: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyShapeAlert: vi.fn(async () => {}) }))

import { POST } from '@/app/(frontend)/api/webhooks/facebook-leads/route'
import { verifySignature } from '@/lib/leads/verify-signature'
import { fetchLead } from '@/lib/leads/fetch-lead'
import { captureLead } from '@/lib/leads/capture-lead'
import { notifyShapeAlert } from '@/lib/leads/notify'

// Fabricated, PII-free. Passes leadSchema; 'adres_e-mail' key → email via the heuristic.
const validLead = {
  id: '1000000000000001',
  created_time: '2026-07-05T18:48:40+0000',
  field_data: [{ name: 'adres_e-mail', values: ['jan@example.com'] }],
}

const bodyFor = (leadgenId: string) =>
  JSON.stringify({ entry: [{ changes: [{ value: { leadgen_id: leadgenId } }] }] })

const makeRequest = (raw: string, sig = 'sha256=deadbeef'): NextRequest =>
  ({
    text: async () => raw,
    headers: new Headers({ 'x-hub-signature-256': sig }),
  }) as unknown as NextRequest

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(verifySignature).mockReturnValue(true)
  vi.mocked(fetchLead).mockResolvedValue(validLead)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(captureLead).mockResolvedValue({ lead: { id: 1 } as any, created: true })
  vi.mocked(notifyShapeAlert).mockResolvedValue(undefined)
})

describe('POST /api/webhooks/facebook-leads — Meta retry contract', () => {
  it('rejects a bad signature with 403 and does not process', async () => {
    vi.mocked(verifySignature).mockReturnValueOnce(false)
    const res = await POST(makeRequest(bodyFor('1000000000000001')))
    expect(res.status).toBe(403)
    expect(fetchLead).not.toHaveBeenCalled()
  })

  it('acks a valid lead with 200', async () => {
    const res = await POST(makeRequest(bodyFor('1000000000000001')))
    expect(res.status).toBe(200)
    expect(captureLead).toHaveBeenCalledTimes(1)
  })

  it('acks a malformed (but signed) body with 200 so Meta stops retrying', async () => {
    const res = await POST(makeRequest('not-json{'))
    expect(res.status).toBe(200)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('acks a schema-invalid lead with 200 (retry cannot fix a bad shape) and alerts ops', async () => {
    vi.mocked(fetchLead).mockResolvedValueOnce({ garbage: true })
    const res = await POST(makeRequest(bodyFor('1000000000000001')))
    expect(res.status).toBe(200)
    expect(notifyShapeAlert).toHaveBeenCalledTimes(1)
    expect(captureLead).not.toHaveBeenCalled()
  })

  // The bug: a store-time throw was swallowed and 200'd → Meta never retries → lead lost.
  it('returns non-200 when a lead fails to store, so Meta retries', async () => {
    vi.mocked(captureLead).mockRejectedValueOnce(new Error('db connection dropped'))
    const res = await POST(makeRequest(bodyFor('1000000000000001')))
    expect(res.status).toBe(500)
  })

  it('still isolates a failing lead from its siblings, then retries the batch', async () => {
    vi.mocked(captureLead)
      .mockRejectedValueOnce(new Error('db blip'))
      .mockResolvedValueOnce({ lead: { id: 2 } as never, created: true })
    const raw = JSON.stringify({
      entry: [{ changes: [{ value: { leadgen_id: 'a' } }, { value: { leadgen_id: 'b' } }] }],
    })
    const res = await POST(makeRequest(raw))
    // Sibling 'b' was still processed despite 'a' throwing...
    expect(captureLead).toHaveBeenCalledTimes(2)
    // ...but the batch signals failure so Meta redelivers (idempotent store skips 'b').
    expect(res.status).toBe(500)
  })
})
