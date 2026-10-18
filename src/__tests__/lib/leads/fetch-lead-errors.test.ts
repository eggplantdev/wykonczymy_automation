import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/lib/env/server', () => ({
  serverEnv: { META_PAGE_ACCESS_TOKEN: 'test-token' },
}))

import { fetchLead } from '@/lib/leads/fetch-lead'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchLead', () => {
  // Returning the error body instead would fail leadSchema and get ACKed 200 → the lead is lost
  // forever.
  it('throws on a non-2xx Graph response (recoverable → route retries)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Service temporarily unavailable', code: 2 } }),
    })

    await expect(fetchLead('1000000000000001')).rejects.toThrow()
  })
})
