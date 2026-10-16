import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// The fill itself is covered by the action's spec; this asserts what the route adds — the auth gate
// and that the katalog's cache expires exactly when a translation landed.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn(async () => ({})) }))
vi.mock('@/lib/ai/fill-catalogue-translations', () => ({ fillCatalogueTranslations: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/translate-catalogue/route'
import { revalidateTag } from 'next/cache'
import { fillCatalogueTranslations } from '@/lib/ai/fill-catalogue-translations'
import { CACHE_TAGS, EXPIRE_NOW } from '@/lib/cache/tags'

describe('cron translate-catalogue route', () => {
  const previous = process.env.CRON_SECRET
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
    consoleError.mockRestore()
    vi.clearAllMocks()
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/translate-catalogue', { headers })
  }

  const authorized = () => request({ authorization: 'Bearer test-secret' })

  it('rejects an unauthorized request without translating', async () => {
    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(fillCatalogueTranslations).not.toHaveBeenCalled()
  })

  it('expires the katalog cache when translations landed', async () => {
    vi.mocked(fillCatalogueTranslations).mockResolvedValue({ items: 5, failed: 1 })

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: false, items: 5, failed: 1 })
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.workCatalogue, EXPIRE_NOW)
  })

  // `translateRows` never rejects, so an OpenRouter outage arrives as failed batches, not a throw.
  it('reads as a failed run when every batch failed', async () => {
    vi.mocked(fillCatalogueTranslations).mockResolvedValue({ items: 0, failed: 3 })

    const res = await GET(authorized())

    await expect(res.json()).resolves.toEqual({ ok: false, items: 0, failed: 3 })
  })

  it('leaves the cache alone when nothing was written', async () => {
    vi.mocked(fillCatalogueTranslations).mockResolvedValue({ items: 0, failed: 0 })

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('reads as a failed run when the fill throws', async () => {
    vi.mocked(fillCatalogueTranslations).mockRejectedValue(new Error('db down'))

    const res = await GET(authorized())

    expect(res.status).toBe(500)
    expect(revalidateTag).not.toHaveBeenCalled()
  })
})
