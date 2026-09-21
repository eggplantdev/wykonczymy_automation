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
  // The whole point of the one-field body: a caller who can forge or replay this can only ever
  // destroy the files of a submission that was already delivered, never arbitrary bytes.
  it('names the submission and nothing else', async () => {
    await releaseLandingAssets('11111111-2222-3333-4444-555555555555')

    expect(JSON.parse(lastCall().body)).toEqual({
      submissionId: '11111111-2222-3333-4444-555555555555',
    })
  })

  // Signed with the same scheme the inbound webhook verifies, over the bytes actually sent — so the
  // landing can refuse a forgery at all. Asserted by verifying, not by recomputing the digest here,
  // which would only restate the implementation.
  it('signs the exact bytes it sends, under the shared secret', async () => {
    await releaseLandingAssets('11111111-2222-3333-4444-555555555555')
    const { init, body } = lastCall()
    const signature = new Headers(init.headers).get('x-landing-signature')

    expect(verifySignature(body, signature, 'test-secret')).toBe(true)
    expect(verifySignature(body, signature, 'other-secret')).toBe(false)
  })

  // While the landing half is unbuilt there is nothing to call, and the webhook is useful without
  // it — so the absence is a skip, never a throw that would reach the handler.
  it('does nothing when no callback URL is configured', async () => {
    serverEnv.LANDING_CLEANUP_URL = undefined

    await expect(releaseLandingAssets('id')).resolves.toBeUndefined()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // The enquiry is already stored and its assets already attached: a landing that is down must not
  // turn a delivered submission into a retried one. The cost is an orphaned prefix its sweep takes.
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
