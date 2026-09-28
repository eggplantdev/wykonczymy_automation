import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Payload and the DB are mocked out: the reject path never reaches them, and the authorized path
// only needs to prove what the route FORWARDS. The steps themselves are covered against a real DB in
// lib/db/snapshots.test.ts and lib/investments/purge-trash.db.test.ts.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/db/snapshots', () => ({ gcSnapshots: vi.fn() }))
vi.mock('@/lib/investments/purge-trash', () => ({ purgeTrash: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/cleanup/route'
import { getPayload } from 'payload'
import { gcSnapshots } from '@/lib/db/snapshots'
import { purgeTrash } from '@/lib/investments/purge-trash'

const TRASH = { purged: 2, skippedKosztorys: 1, blocked: 0, failed: 0 }

describe('cron cleanup route', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
    vi.clearAllMocks()
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/cleanup', { headers })
  }

  it('rejects a request with no Authorization header', async () => {
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('rejects a request with the wrong secret', async () => {
    const res = await GET(request({ authorization: 'Bearer wrong' }))
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })

  it('fails closed when CRON_SECRET is unset', async () => {
    delete process.env.CRON_SECRET
    const res = await GET(request({ authorization: 'Bearer test-secret' }))
    expect(res.status).toBe(401)
    expect(getPayload).not.toHaveBeenCalled()
  })

  // The per-band breakdown is the only reading that tells the owner whether a retention change is
  // behaving on its first night, and it is worth nothing if the route flattens it on the way out.
  it('forwards the per-band retention breakdown on an authorized request', async () => {
    vi.mocked(gcSnapshots).mockResolvedValue({ deleted: 7, ceiling: 2, daily: 4, weekly: 1 })
    vi.mocked(purgeTrash).mockResolvedValue(TRASH)

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      snapshots: { deleted: 7, ceiling: 2, daily: 4, weekly: 1 },
      trash: TRASH,
    })
  })

  it('still reports the snapshot sweep when the trash purge throws', async () => {
    vi.mocked(gcSnapshots).mockResolvedValue({ deleted: 1, ceiling: 0, daily: 1, weekly: 0 })
    vi.mocked(purgeTrash).mockRejectedValue(new Error('boom'))

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      snapshots: { deleted: 1, ceiling: 0, daily: 1, weekly: 0 },
      trash: null,
    })
  })

  it('still purges the trash when the snapshot sweep throws, and fails only when both do', async () => {
    vi.mocked(gcSnapshots).mockRejectedValue(new Error('boom'))
    vi.mocked(purgeTrash).mockResolvedValue(TRASH)

    const partial = await GET(request({ authorization: 'Bearer test-secret' }))
    expect(partial.status).toBe(200)
    await expect(partial.json()).resolves.toEqual({ ok: false, snapshots: null, trash: TRASH })

    vi.mocked(purgeTrash).mockRejectedValue(new Error('boom'))
    const total = await GET(request({ authorization: 'Bearer test-secret' }))
    expect(total.status).toBe(500)
  })
})
