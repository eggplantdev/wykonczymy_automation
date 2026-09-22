import { describe, it, expect, vi, beforeEach } from 'vitest'

// Hoisted: vi.mock's factory runs before module-level consts exist, and the spec mutates the env
// between cases to cover the unconfigured branch.
const { serverEnv } = vi.hoisted(() => ({
  serverEnv: { LANDING_WEBHOOK_SECRET: 'test-secret' } as {
    LANDING_WEBHOOK_SECRET: string
    LANDING_CLEANUP_URL?: string
  },
}))
vi.mock('@/lib/env/server', () => ({ serverEnv }))
vi.mock('@/lib/utils/log-error', () => ({ logError: vi.fn() }))

import { releaseLandingAssets } from '@/lib/leads/release-landing-assets'
import { verifySignature } from '@/lib/leads/verify-signature'
import { logError } from '@/lib/utils/log-error'

const fetchMock = vi.fn(async () => ({ ok: true, status: 200 }))
vi.stubGlobal('fetch', fetchMock)

const lastCall = () => {
  const [url, init] = fetchMock.mock.calls.at(-1) as unknown as [string, RequestInit]
  return { url, init, body: String(init.body) }
}

beforeEach(() => {
  vi.clearAllMocks()
  serverEnv.LANDING_CLEANUP_URL = 'https://landing.example/api/leads/cleanup'
  fetchMock.mockResolvedValue({ ok: true, status: 200 })
})

describe('the cleanup callback', () => {
  it('names the submission and nothing else', async () => {
    await releaseLandingAssets('11111111-2222-3333-4444-555555555555')

    expect(JSON.parse(lastCall().body)).toEqual({
      submissionId: '11111111-2222-3333-4444-555555555555',
    })
  })

  // Asserted by verifying, not by recomputing the digest here, which would only restate the
  // implementation.
  it('signs the exact bytes it sends, under the cleanup scope', async () => {
    await releaseLandingAssets('11111111-2222-3333-4444-555555555555')
    const { init, body } = lastCall()
    const signature = new Headers(init.headers).get('x-landing-signature')

    expect(verifySignature(body, signature, 'test-secret', 'landing-cleanup')).toBe(true)
    expect(verifySignature(body, signature, 'other-secret', 'landing-cleanup')).toBe(false)
    // The scope is what stops a captured submission from doubling as a delete instruction.
    expect(verifySignature(body, signature, 'test-secret', 'landing-submission')).toBe(false)
  })

  it('does nothing when no callback URL is configured', async () => {
    serverEnv.LANDING_CLEANUP_URL = undefined

    await expect(releaseLandingAssets('id')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('swallows a network failure rather than failing the delivery', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'))

    await expect(releaseLandingAssets('id')).resolves.toBeUndefined()
    expect(logError).toHaveBeenCalled()
  })

  it('swallows a refusal and reports the status', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 })

    await expect(releaseLandingAssets('id')).resolves.toBeUndefined()
    expect(vi.mocked(logError).mock.calls.at(-1)?.[1]).toContain('403')
  })
})
