import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// The reject path returns before touching Payload/DB, so mock them cheaply — the test asserts the
// auth gate alone (the age-cap GC itself is covered against a real DB in lib/db/snapshots.test.ts).
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/db/snapshots', () => ({ gcSnapshots: vi.fn() }))

import { GET } from '@/app/(payload)/api/cron/cleanup/route'
import { getPayload } from 'payload'

describe('cron cleanup route auth gate', () => {
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
})
