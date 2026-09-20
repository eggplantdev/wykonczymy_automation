import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { NextRequest } from 'next/server'

// The sweep itself is covered in lib/leads/reconcile-sweep.test.ts and the auth rule in
// lib/cron/verify-cron-request.test.ts; this asserts what the route adds — the cache
// flush, and the rule that both a recovery AND a failed sweep alert. A silent cron
// patching a dead webhook forever is the failure this route exists to prevent.
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn(async () => ({})) }))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))
vi.mock('@/lib/leads/reconcile-sweep', () => ({ runLeadReconcileSweep: vi.fn() }))
vi.mock('@/lib/leads/notify', () => ({
  notifyReconcileRecovery: vi.fn(),
  notifyReconcileFailure: vi.fn(),
}))

import { GET } from '@/app/(payload)/api/cron/leads-reconcile/route'
import { revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache/tags'
import { runLeadReconcileSweep } from '@/lib/leads/reconcile-sweep'
import { notifyReconcileRecovery, notifyReconcileFailure } from '@/lib/leads/notify'

const recoveredLead = (id: number) => ({
  id,
  name: `Lead ${id}`,
  formName: 'Formularz',
  submittedAt: '2026-08-10T02:00:00.000Z',
})

const sweepResult = (over: Partial<Awaited<ReturnType<typeof runLeadReconcileSweep>>> = {}) => ({
  recovered: [],
  scanned: 30,
  failedForms: [],
  saturatedForms: [],
  ...over,
})

describe('cron leads-reconcile route', () => {
  const previous = process.env.CRON_SECRET
  let consoleError: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-secret'
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(notifyReconcileRecovery).mockResolvedValue(undefined)
    vi.mocked(notifyReconcileFailure).mockResolvedValue(undefined)
  })

  afterEach(() => {
    process.env.CRON_SECRET = previous
    consoleError.mockRestore()
    vi.clearAllMocks()
  })

  function request(headers: Record<string, string> = {}) {
    return new NextRequest('http://localhost/api/cron/leads-reconcile', { headers })
  }

  const authorized = () => request({ authorization: 'Bearer test-secret' })

  it('rejects an unauthorized request without touching the sweep', async () => {
    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(runLeadReconcileSweep).not.toHaveBeenCalled()
  })

  it('alerts once and flushes the leads cache when the sweep recovered leads', async () => {
    const recovered = [recoveredLead(1), recoveredLead(2)]
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(sweepResult({ recovered }))

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      ok: true,
      added: 2,
      scanned: 30,
      saturatedForms: [],
    })
    // Without this the dashboard serves a stale list — leads recovered, nothing visible.
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.leads, { expire: 0 })
    expect(notifyReconcileRecovery).toHaveBeenCalledTimes(1)
    // The leads themselves, not just a count — a recovered lead is stamped `skipped`,
    // so this mail is the only place sales ever sees it (EX-660).
    expect(notifyReconcileRecovery).toHaveBeenCalledWith(expect.anything(), {
      recovered,
      scanned: 30,
      saturatedForms: [],
    })
  })

  it('stays silent and leaves the cache alone on a clean run', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(sweepResult())

    const res = await GET(authorized())

    expect(res.status).toBe(200)
    expect(revalidateTag).not.toHaveBeenCalled()
    expect(notifyReconcileRecovery).not.toHaveBeenCalled()
    expect(notifyReconcileFailure).not.toHaveBeenCalled()
  })

  it('passes the saturation flag into the recovery alert', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(
      sweepResult({ recovered: [recoveredLead(1)], saturatedForms: ['A'] }),
    )

    await GET(authorized())

    expect(notifyReconcileRecovery).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ saturatedForms: ['A'] }),
    )
  })

  // A backstop that dies the same day the webhook does must not fail silently — the
  // 500 only reaches a Vercel log nobody reads until they already suspect a problem.
  it('alerts when the sweep throws, and still reports a failed run', async () => {
    vi.mocked(runLeadReconcileSweep).mockRejectedValue(new Error('Graph request failed'))

    const res = await GET(authorized())

    expect(res.status).toBe(500)
    expect(notifyReconcileFailure).toHaveBeenCalledTimes(1)
    expect(notifyReconcileFailure).toHaveBeenCalledWith(expect.anything(), {
      reason: 'Graph request failed',
    })
    expect(notifyReconcileRecovery).not.toHaveBeenCalled()
  })

  it('alerts and fails the run when only some forms could be swept', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(
      sweepResult({ recovered: [recoveredLead(1)], failedForms: ['B'] }),
    )

    const res = await GET(authorized())

    expect(res.status).toBe(500)
    await expect(res.json()).resolves.toEqual({
      ok: false,
      added: 1,
      scanned: 30,
      failedForms: ['B'],
      saturatedForms: [],
    })
    // The leads that DID come back are already persisted, so they still owe both.
    expect(revalidateTag).toHaveBeenCalledWith(CACHE_TAGS.leads, { expire: 0 })
    expect(notifyReconcileRecovery).toHaveBeenCalledTimes(1)
    expect(notifyReconcileFailure).toHaveBeenCalledWith(expect.anything(), {
      reason: expect.any(String),
      failedForms: ['B'],
    })
  })

  it('still reports the recovery when the alert email fails to send', async () => {
    vi.mocked(runLeadReconcileSweep).mockResolvedValue(
      sweepResult({ recovered: [recoveredLead(1)] }),
    )
    vi.mocked(notifyReconcileRecovery).mockRejectedValue(new Error('SMTP down'))

    const res = await GET(authorized())

    expect(res.status).toBe(200)
  })
})
