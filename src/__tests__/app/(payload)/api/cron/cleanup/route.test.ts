import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// Payload and the DB are mocked out: the reject path never reaches them, and the authorized path
// only needs to prove what the route FORWARDS. The steps themselves are covered against a real DB in
// their own specs.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/db/get-db', () => ({ getDb: vi.fn() }))
vi.mock('@/lib/db/snapshots', () => ({ gcSnapshots: vi.fn() }))
vi.mock('@/lib/investments/purge-trash', () => ({ purgeTrash: vi.fn() }))
vi.mock('@/lib/cash-registers/purge-trash', () => ({ purgeCashRegisterTrash: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/cleanup/route'
import { getPayload } from 'payload'
import { gcSnapshots } from '@/lib/db/snapshots'
import { purgeTrash } from '@/lib/investments/purge-trash'
import { purgeCashRegisterTrash } from '@/lib/cash-registers/purge-trash'
import { revalidateTag } from '@/__tests__/stubs/next-cache'
import { CACHE_TAGS } from '@/lib/cache/tags'

const TRASH = { purged: 2, skippedKosztorys: 1, blocked: 0, failed: 0 }
const CASH_REGISTER_TRASH = { purged: 1, blocked: 0, failed: 0 }

describe('cron cleanup route', () => {
  const previous = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(purgeCashRegisterTrash).mockResolvedValue(CASH_REGISTER_TRASH)
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
    vi.mocked(gcSnapshots).mockResolvedValue({
      deleted: 7,
      ceiling: 2,
      daily: 4,
      weekly: 1,
      investorExpired: 0,
    })
    vi.mocked(purgeTrash).mockResolvedValue(TRASH)

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      snapshots: { deleted: 7, ceiling: 2, daily: 4, weekly: 1, investorExpired: 0 },
      trash: TRASH,
      cashRegisterTrash: CASH_REGISTER_TRASH,
    })
    // The investor's history list is cached; a sweep that removed versions must evict it.
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.kosztorysSnapshots, { expire: 0 })
  })

  it('still reports the snapshot sweep when the trash purge throws', async () => {
    vi.mocked(gcSnapshots).mockResolvedValue({
      deleted: 1,
      ceiling: 0,
      daily: 1,
      weekly: 0,
      investorExpired: 0,
    })
    vi.mocked(purgeTrash).mockRejectedValue(new Error('boom'))

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      snapshots: { deleted: 1, ceiling: 0, daily: 1, weekly: 0, investorExpired: 0 },
      trash: null,
      cashRegisterTrash: CASH_REGISTER_TRASH,
    })
  })

  it('still purges the trash when the snapshot sweep throws, and fails only when every step does', async () => {
    vi.mocked(gcSnapshots).mockRejectedValue(new Error('boom'))
    vi.mocked(purgeTrash).mockResolvedValue(TRASH)

    const partial = await GET(request({ authorization: 'Bearer test-secret' }))
    expect(partial.status).toBe(200)
    await expect(partial.json()).resolves.toEqual({
      ok: false,
      snapshots: null,
      trash: TRASH,
      cashRegisterTrash: CASH_REGISTER_TRASH,
    })

    vi.mocked(purgeTrash).mockRejectedValue(new Error('boom'))
    vi.mocked(purgeCashRegisterTrash).mockRejectedValue(new Error('boom'))
    const total = await GET(request({ authorization: 'Bearer test-secret' }))
    expect(total.status).toBe(500)
  })
  it('still reports the investment purge when the kasa purge throws', async () => {
    vi.mocked(gcSnapshots).mockResolvedValue({
      deleted: 0,
      ceiling: 0,
      daily: 0,
      weekly: 0,
      investorExpired: 0,
    })
    vi.mocked(purgeTrash).mockResolvedValue(TRASH)
    vi.mocked(purgeCashRegisterTrash).mockRejectedValue(new Error('boom'))

    const res = await GET(request({ authorization: 'Bearer test-secret' }))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({
      ok: false,
      trash: TRASH,
      cashRegisterTrash: null,
    })
  })
})
