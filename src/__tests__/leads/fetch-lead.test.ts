import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// fetchLead must throw on a non-2xx Graph response so the webhook route's catch
// treats it as recoverable (→ non-200 → Meta redelivers). Returning the error
// body instead would fail leadSchema and get ACKed 200 → the lead is lost forever.
vi.mock('@/lib/env.server', () => ({
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
  it('throws on a non-2xx Graph response (recoverable → route retries)', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: { message: 'Service temporarily unavailable', code: 2 } }),
    })

    await expect(fetchLead('1000000000000001')).rejects.toThrow()
  })

  it('throws when the body carries a Graph error object despite a 200', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ error: { message: 'Rate limited', code: 613 } }),
    })

    await expect(fetchLead('1000000000000001')).rejects.toThrow()
  })

  it('returns the raw body on success', async () => {
    const lead = { id: '1', created_time: 't', field_data: [] }
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => lead })

    await expect(fetchLead('1')).resolves.toEqual(lead)
  })
})
