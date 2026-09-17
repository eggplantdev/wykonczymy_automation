import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchLead } from '@/lib/leads/fetch-lead'

const LEAD = {
  id: '876704198733519',
  created_time: '2026-09-12T14:12:39+0000',
  form_id: '899352536400611',
  field_data: [],
}

function mockFetch(body: unknown, ok = true) {
  const fetchMock = vi.fn(async (_url: string) => ({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => {
  process.env.META_PAGE_ACCESS_TOKEN = 'test-token'
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchLead', () => {
  // Graph returns only what the query asks for, and its default omits `form_id` (verified against
  // the live API 2026-09-15). Without it every lead persisted formless, silencing `fetchFormQuestions`
  // (early-returns on a missing id) — answers rendered as raw keys, losing Meta's typed fields.
  it('asks Graph for form_id explicitly', async () => {
    const fetchMock = mockFetch(LEAD)

    await fetchLead(LEAD.id)

    const url = fetchMock.mock.calls[0]![0]
    const fields = new URL(url).searchParams.get('fields')?.split(',') ?? []
    expect(fields).toContain('form_id')
    expect(fields).toContain('field_data')
    expect(fields).toContain('created_time')
  })

  it('returns the raw body untouched', async () => {
    mockFetch(LEAD)
    await expect(fetchLead(LEAD.id)).resolves.toEqual(LEAD)
  })

  // Load-bearing: a thrown error lands in the route's catch → non-200 → Meta redelivers.
  it('throws on an error body so Meta redelivers', async () => {
    mockFetch({ error: { message: 'rate limited', code: 613 } })
    await expect(fetchLead(LEAD.id)).rejects.toThrow(/876704198733519/)
  })
})
