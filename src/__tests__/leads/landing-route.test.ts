import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHmac } from 'crypto'
import type { NextRequest } from 'next/server'
import { LANDING_SUBMISSION } from '@/__tests__/fixtures/landing-submission'

// Route-handler unit test, mirroring wpforms-route.test.ts: the DB, the mailer and the asset
// fetcher are the mocked seams; the signature check and the landing parser stay real. What is
// under test is which requests are refused, and — the branches unique to this route — that a file
// that cannot be pulled never costs us the enquiry, and that a replay costs us nothing at all.
vi.mock('next/server', () => ({
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({}) }))
vi.mock('@/lib/env/server', () => ({ serverEnv: { LANDING_WEBHOOK_SECRET: 'test-secret' } }))
vi.mock('@/lib/leads/capture-lead', () => ({ captureLead: vi.fn() }))
vi.mock('@/lib/leads/store-lead', () => ({ findStoredLead: vi.fn(async () => undefined) }))
vi.mock('@/lib/leads/fetch-landing-asset', () => ({ fetchLandingAsset: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({
  notifyShapeAlert: vi.fn(async () => {}),
  notifyAssetFailure: vi.fn(async () => {}),
}))

import { POST } from '@/app/(frontend)/api/webhooks/landing/route'
import { captureLead } from '@/lib/leads/capture-lead'
import { findStoredLead } from '@/lib/leads/store-lead'
import { fetchLandingAsset } from '@/lib/leads/fetch-landing-asset'
import { notifyShapeAlert, notifyAssetFailure } from '@/lib/leads/notify'

const sign = (raw: string, secret = 'test-secret') =>
  'sha256=' + createHmac('sha256', secret).update(raw, 'utf8').digest('hex')

const makeRequest = (raw: string, signature = sign(raw)): NextRequest =>
  ({
    text: async () => raw,
    headers: new Headers({ 'x-landing-signature': signature }),
  }) as unknown as NextRequest

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...LANDING_SUBMISSION, ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(captureLead).mockResolvedValue({ lead: { id: 1 } as any, created: true })
  vi.mocked(findStoredLead).mockResolvedValue(undefined)
  vi.mocked(fetchLandingAsset).mockImplementation(
    async () => 100 + vi.mocked(fetchLandingAsset).mock.calls.length,
  )
})

describe('POST /api/webhooks/landing', () => {
  it('rejects a tampered body with 403 and does not capture', async () => {
    const raw = body()
    const res = await POST(makeRequest(raw + ' ', sign(raw)))
    expect(res.status).toBe(403)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a missing signature with 403', async () => {
    const req = { text: async () => body(), headers: new Headers() } as unknown as NextRequest
    expect((await POST(req)).status).toBe(403)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a malformed JSON body with 400', async () => {
    const res = await POST(makeRequest('not-json{'))
    expect(res.status).toBe(400)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('rejects a bad envelope with 400 and alerts ops', async () => {
    const res = await POST(makeRequest(body({ submissionId: 'not-a-uuid' })))
    expect(res.status).toBe(400)
    expect(notifyShapeAlert).toHaveBeenCalledTimes(1)
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('captures a signed submission as landing_form with both assets attached', async () => {
    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(fetchLandingAsset).toHaveBeenCalledTimes(2)
    const input = vi.mocked(captureLead).mock.calls[0][1]
    expect(input.source).toBe('landing_form')
    expect(input.externalId).toBe(LANDING_SUBMISSION.submissionId)
    expect(input.assets).toEqual([101, 102])
    expect(notifyAssetFailure).not.toHaveBeenCalled()
  })

  // The decision this route is built around: an incomplete photo set is the lesser failure, and
  // 200 is what lets the landing clear its queue row instead of replaying the whole submission.
  it('stores the lead, alerts and answers 200 when one asset cannot be pulled', async () => {
    vi.mocked(fetchLandingAsset)
      .mockRejectedValueOnce(new Error('Niedozwolony host: evil.example.com'))
      .mockResolvedValueOnce(777)

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(vi.mocked(captureLead).mock.calls[0][1].assets).toEqual([777])
    const alert = vi.mocked(notifyAssetFailure).mock.calls[0][1]
    expect(alert.stored).toBe(1)
    expect(alert.failed).toHaveLength(1)
    // The url rides along because the file is still live in the landing's store — the alert is a
    // recovery instruction, not just a record.
    expect(alert.failed[0].url).toBe(LANDING_SUBMISSION.assets![0].url)
  })

  it('re-downloads nothing and re-alerts nothing on a redelivery', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(findStoredLead).mockResolvedValue({ id: 1 } as any)
    vi.mocked(captureLead).mockResolvedValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      lead: { id: 1 } as any,
      created: false,
    })

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    // The guard that matters: a second download would leave a second set of orphan media rows.
    expect(fetchLandingAsset).not.toHaveBeenCalled()
    expect(notifyAssetFailure).not.toHaveBeenCalled()
  })

  it('returns 500 when the lead itself fails to capture', async () => {
    vi.mocked(captureLead).mockRejectedValueOnce(new Error('db connection dropped'))
    expect((await POST(makeRequest(body()))).status).toBe(500)
  })
})
