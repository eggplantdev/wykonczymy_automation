import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'
import { LANDING_SUBMISSION } from '@/__tests__/fixtures/landing-submission'

vi.mock('next/server', () => ({
  after: (fn: () => unknown) => void fn(),
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({ status: init?.status ?? 200, body }),
  },
}))
vi.mock('@payload-config', () => ({ default: {} }))

const update = vi.fn(async () => ({}))
vi.mock('payload', () => ({ getPayload: async () => ({ update }) }))
vi.mock('@/lib/env/server', () => ({ serverEnv: { LANDING_WEBHOOK_SECRET: 'test-secret' } }))
vi.mock('@/lib/leads/capture-lead', () => ({ captureLead: vi.fn() }))
vi.mock('@/lib/leads/fetch-landing-asset', () => ({ fetchLandingAsset: vi.fn() }))
vi.mock('@/lib/media/delete-unreferenced-media', () => ({ deleteUnreferencedMedia: vi.fn() }))
vi.mock('@/lib/leads/release-landing-assets', () => ({
  releaseLandingAssets: vi.fn(async () => {}),
}))
vi.mock('@/lib/leads/notify', () => ({
  notifyShapeAlert: vi.fn(async () => {}),
  notifyAssetFailure: vi.fn(async () => {}),
}))

import { POST } from '@/app/(frontend)/api/webhooks/landing/route'
import { captureLead } from '@/lib/leads/capture-lead'
import { fetchLandingAsset } from '@/lib/leads/fetch-landing-asset'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { notifyShapeAlert, notifyAssetFailure } from '@/lib/leads/notify'
import { releaseLandingAssets } from '@/lib/leads/release-landing-assets'
import { signBody } from '@/lib/leads/verify-signature'

const sign = (raw: string, secret = 'test-secret') => signBody(raw, secret, 'landing-submission')

const makeRequest = (raw: string, signature = sign(raw)): NextRequest =>
  ({
    text: async () => raw,
    headers: new Headers({ 'x-landing-signature': signature }),
  }) as unknown as NextRequest

const body = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({ ...LANDING_SUBMISSION, ...overrides })

/* eslint-disable @typescript-eslint/no-explicit-any */
const capturedLead = (assets?: unknown, created = true) =>
  vi.mocked(captureLead).mockResolvedValue({ lead: { id: 1, assets } as any, created })
/* eslint-enable @typescript-eslint/no-explicit-any */

beforeEach(() => {
  vi.clearAllMocks()
  capturedLead()
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

  it('captures a signed submission as landing_form, then attaches both assets', async () => {
    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(fetchLandingAsset).toHaveBeenCalledTimes(2)
    const input = vi.mocked(captureLead).mock.calls[0][1]
    expect(input.source).toBe('landing_form')
    expect(input.externalId).toBe(LANDING_SUBMISSION.submissionId)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'leads', id: 1, data: { assets: [101, 102] } }),
    )
    expect(notifyAssetFailure).not.toHaveBeenCalled()
  })

  it('persists the lead even when every asset fetch throws', async () => {
    vi.mocked(fetchLandingAsset).mockRejectedValue(new Error('Pobranie nie powiodło się: HTTP 502'))

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(captureLead).toHaveBeenCalledTimes(1)
    expect(update).not.toHaveBeenCalled()
    expect(vi.mocked(notifyAssetFailure).mock.calls[0][1].stored).toBe(0)
  })

  // 200 is what lets the landing clear its queue row instead of replaying the whole submission.
  it('stores the lead, alerts and answers 200 when one asset cannot be pulled', async () => {
    vi.mocked(fetchLandingAsset)
      .mockRejectedValueOnce(new Error('Niedozwolony host: evil.example.com'))
      .mockResolvedValueOnce(777)

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { assets: [777] } }))
    const alert = vi.mocked(notifyAssetFailure).mock.calls[0][1]
    expect(alert.stored).toBe(1)
    expect(alert.failed).toHaveLength(1)
    expect(alert.failed[0].url).toBe(LANDING_SUBMISSION.assets![0].url)
  })

  // Blob has no undelete and nothing points at the rows once the attach failed, so they would be
  // billed forever with no surface able to show them.
  it('reclaims the media it stored when the attach write fails', async () => {
    update.mockRejectedValueOnce(new Error('db connection dropped'))

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    expect(deleteUnreferencedMedia).toHaveBeenCalledWith(expect.anything(), [101, 102])
  })

  it('re-downloads nothing and re-alerts nothing on a redelivery that kept its files', async () => {
    capturedLead([11, 12], false)

    const res = await POST(makeRequest(body()))

    expect(res.status).toBe(200)
    // The guard that matters: a second download would leave a second set of orphan media rows.
    expect(fetchLandingAsset).not.toHaveBeenCalled()
    expect(update).not.toHaveBeenCalled()
    expect(notifyAssetFailure).not.toHaveBeenCalled()
  })

  it('retries the download when the captured lead carries no files', async () => {
    capturedLead([], false)

    expect((await POST(makeRequest(body()))).status).toBe(200)
    expect(fetchLandingAsset).toHaveBeenCalledTimes(2)
  })

  it('downloads nothing for an erased lead, and releases the landing copies', async () => {
    vi.mocked(captureLead).mockResolvedValue({
      lead: { id: 1, assets: [], erasedAt: '2026-10-02T00:00:00.000Z' } as any,
      created: false,
    })

    expect((await POST(makeRequest(body()))).status).toBe(200)
    expect(fetchLandingAsset).not.toHaveBeenCalled()
    expect(releaseLandingAssets).toHaveBeenCalledWith(LANDING_SUBMISSION.submissionId)
  })

  it('releases the landing copies once the whole set is attached', async () => {
    await POST(makeRequest(body()))

    expect(releaseLandingAssets).toHaveBeenCalledWith(LANDING_SUBMISSION.submissionId)
  })

  it('keeps the landing copies when one asset could not be pulled', async () => {
    vi.mocked(fetchLandingAsset)
      .mockRejectedValueOnce(new Error('Niedozwolony host: evil.example.com'))
      .mockResolvedValueOnce(777)

    await POST(makeRequest(body()))

    // The failed file's only remaining copy is the landing's — deleting the prefix would lose it.
    expect(releaseLandingAssets).not.toHaveBeenCalled()
  })

  it('keeps the landing copies on a redelivery that is missing a file', async () => {
    capturedLead([101], false)

    await POST(makeRequest(body()))

    expect(fetchLandingAsset).not.toHaveBeenCalled()
    expect(releaseLandingAssets).not.toHaveBeenCalled()
  })

  it('releases again on a redelivery whose first pass was complete', async () => {
    capturedLead([101, 102], false)

    await POST(makeRequest(body()))

    expect(releaseLandingAssets).toHaveBeenCalledWith(LANDING_SUBMISSION.submissionId)
  })

  // Releasing here would leave the enquiry with no photos anywhere.
  it('keeps the landing copies when the attach write fails', async () => {
    update.mockRejectedValueOnce(new Error('db connection dropped'))

    await POST(makeRequest(body()))

    expect(releaseLandingAssets).not.toHaveBeenCalled()
  })

  it('returns 500 when the lead itself fails to capture', async () => {
    vi.mocked(captureLead).mockRejectedValueOnce(new Error('db connection dropped'))
    expect((await POST(makeRequest(body()))).status).toBe(500)
    expect(fetchLandingAsset).not.toHaveBeenCalled()
  })
})
