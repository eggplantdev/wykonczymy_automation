import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Payload and the DB are mocked out: the capture itself is covered against a real DB in
// lib/kosztorys/capture-daily-snapshots.test.ts. This spec proves the gate and what the route
// forwards and expires.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/kosztorys/capture-daily-snapshots', () => ({ captureDailySnapshots: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/daily-snapshots/route'
import { getPayload } from 'payload'
import { captureDailySnapshots } from '@/lib/kosztorys/capture-daily-snapshots'
import { revalidateTag } from '@/__tests__/stubs/next-cache'
import { CACHE_TAGS } from '@/lib/cache/tags'

describe('cron daily-snapshots route', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
    vi.clearAllMocks()
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/daily-snapshots', { headers })
  }

  it('rejects a request without the cron secret', async () => {
    const res = await GET(request({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('forwards the counts and expires the history list when a version was stored', async () => {
    vi.mocked(captureDailySnapshots).mockResolvedValue({ stored: 3, unchanged: 60, failed: 0 })

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({ ok: true, stored: 3, unchanged: 60, failed: 0 })
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.kosztorysSnapshots, { expire: 0 })
  })

  // A quiet night must not evict every investor's cached history for nothing.
  it('leaves the cache alone when nothing was stored', async () => {
    vi.mocked(captureDailySnapshots).mockResolvedValue({ stored: 0, unchanged: 63, failed: 0 })

    await GET(request({ authorization: 'Bearer test-secret' }))

    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('reports ok: false when an investment failed', async () => {
    vi.mocked(captureDailySnapshots).mockResolvedValue({ stored: 2, unchanged: 60, failed: 1 })

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: false, failed: 1 })
  })
})
