import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

// Route-handler unit test. We drive POST directly with a stub request and mock the
// DB/notify/env seams, keeping the wpforms parser + normalize-lead real. The contract
// under test: which requests are rejected (403/400) vs authenticated + captured (200),
// and — the branch unique to this route — that a missing email alerts but never blocks
// the capture (a website lead is saved even when no email could be extracted).
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))
vi.mock('next/cache', () => ({ revalidateTag: () => {} }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/lib/env/server', () => ({ serverEnv: { WPFORMS_WEBHOOK_SECRET: 'test-secret' } }))
vi.mock('@/lib/leads/capture-lead', () => ({ captureLead: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({ notifyShapeAlert: vi.fn(async () => {}) }))

import { POST } from '@/app/(frontend)/api/webhooks/wpforms/route'
import { captureLead } from '@/lib/leads/capture-lead'
import { notifyShapeAlert } from '@/lib/leads/notify'

// Fabricated, PII-free WPForms submission mirroring form 1686 ("/kontakt").
const validFields = {
  '1': { name: 'Adres e-mail', value: 'jan@example.com', type: 'email' },
  '4': { name: 'Imię i nazwisko', value: 'Jan Kowalski', type: 'text' },
  '6': { name: 'Telefon', value: '+48500600700', type: 'text' },
}

const bodyFor = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    form_id: '1686',
    form_name: '/kontakt',
    entry_id: 351,
    fields: validFields,
    ...overrides,
  })

const makeRequest = (raw: string, secret = 'test-secret'): NextRequest =>
  ({
    text: async () => raw,
    headers: new Headers({ 'x-webhook-secret': secret }),
  }) as unknown as NextRequest

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(captureLead).mockResolvedValue({ lead: { id: 1 } as any, created: true })
  vi.mocked(notifyShapeAlert).mockResolvedValue(undefined)
})

describe('POST /api/webhooks/wpforms', () => {
  it('rejects a bad secret with 403 and does not capture', async () => {
    const res = await POST(makeRequest(bodyFor(), 'wrong-secret'))
    expect(res.status).toBe(403)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a missing secret with 403', async () => {
    const req = { text: async () => bodyFor(), headers: new Headers() } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(403)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body with 400 and does not capture', async () => {
    const res = await POST(makeRequest('not-json{'))
    expect(res.status).toBe(400)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a schema-invalid payload with 400 and alerts ops', async () => {
    const res = await POST(makeRequest(JSON.stringify({ form_id: '1686' }))) // no `fields`
    expect(res.status).toBe(400)
    expect(notifyShapeAlert).toHaveBeenCalledTimes(1)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('captures a valid submission with 200 as the website_form source', async () => {
    const res = await POST(makeRequest(bodyFor()))
    expect(res.status).toBe(200)
    expect(captureLead).toHaveBeenCalledTimes(1)
    const input = vi.mocked(captureLead).mock.calls[0][1]
    expect(input.source).toBe('website_form')
    expect(input.email).toBe('jan@example.com')
  })

  // The branch unique to this route: no email extracted must still SAVE the lead
  // (rawData holds everything) and additionally alert on the drift — never drop it.
  it('still captures (200) but alerts when no email can be extracted', async () => {
    const noEmail = { '4': { name: 'Imię i nazwisko', value: 'Jan Kowalski', type: 'text' } }
    const res = await POST(makeRequest(bodyFor({ fields: noEmail })))
    expect(res.status).toBe(200)
    expect(captureLead).toHaveBeenCalledTimes(1)
    expect(notifyShapeAlert).toHaveBeenCalledTimes(1)
  })

  it('returns 500 when the lead fails to capture', async () => {
    vi.mocked(captureLead).mockRejectedValueOnce(new Error('db connection dropped'))
    const res = await POST(makeRequest(bodyFor()))
    expect(res.status).toBe(500)
  })
})
