import { describe, it, expect, vi, beforeEach } from 'vitest'

// Unit test for the manual reconcile action. The Graph fetch, auth, store, and
// revalidation seams are mocked; lead-schema + normalize-lead stay real so the
// parse/normalize path is exercised. Contract under test: backfill is SILENT
// (never emails), idempotent (existing leads aren't re-counted or re-touched),
// sweeps every non-empty form, and is gated on auth.
const { update } = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: async () => ({ update }) }))
vi.mock('@/lib/auth/require-auth', () => ({ requireAuth: vi.fn() }))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollection: vi.fn() }))
vi.mock('@/lib/leads/fetch-recent-leads', () => ({
  listLeadForms: vi.fn(),
  fetchRecentLeads: vi.fn(),
}))
vi.mock('@/lib/leads/fetch-form-questions', () => ({ fetchFormQuestions: vi.fn() }))
vi.mock('@/lib/leads/store-lead', () => ({ storeLead: vi.fn() }))

import { reconcileLeads } from '@/lib/actions/reconcile-leads'
import { requireAuth } from '@/lib/auth/require-auth'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { listLeadForms, fetchRecentLeads } from '@/lib/leads/fetch-recent-leads'
import { fetchFormQuestions } from '@/lib/leads/fetch-form-questions'
import { storeLead } from '@/lib/leads/store-lead'

// Fabricated, PII-free. 'adres_e-mail' key → email via normalizeLead's heuristic.
const rawLead = (id: string) => ({
  id,
  created_time: '2026-07-08T07:09:14+0000',
  field_data: [{ name: 'adres_e-mail', values: [`${id}@example.com`] }],
})

const form = (id: string, leadsCount: number) => ({ id, name: `form-${id}`, leadsCount })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(requireAuth).mockResolvedValue({ success: true, user: { id: 1 } } as never)
  vi.mocked(fetchFormQuestions).mockResolvedValue([])
  update.mockResolvedValue(undefined)
})

describe('reconcileLeads', () => {
  it('silently backfills a new lead: stamps both statuses skipped, never emails, revalidates', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: { added: 1, scanned: 1 } })
    // Stored via storeLead (not captureLead) with revalidation skipped — no notify/auto-reply seam exists here.
    expect(storeLead).toHaveBeenCalledWith(
      expect.objectContaining({ update }),
      expect.objectContaining({
        source: 'facebook_lead_ads',
        externalId: '1',
        email: '1@example.com',
      }),
      { skipRevalidation: true },
    )
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'leads',
        id: 11,
        data: { notifyStatus: 'skipped', autoReplyStatus: 'skipped' },
        context: { skipRevalidation: true },
      }),
    )
    expect(revalidateCollection).toHaveBeenCalledWith('leads')
  })

  it('does not re-count or re-touch a lead that already exists (idempotent)', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 11 }, created: false } as never)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: { added: 0, scanned: 1 } })
    expect(update).not.toHaveBeenCalled()
    expect(revalidateCollection).not.toHaveBeenCalled()
  })

  it('sweeps every non-empty form and skips forms with zero leads', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 2), form('B', 0), form('C', 5)])
    vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) =>
      formId === 'A' ? [rawLead('a1'), rawLead('a2')] : formId === 'C' ? [rawLead('c1')] : [],
    )
    vi.mocked(storeLead).mockResolvedValue({ lead: { id: 99 }, created: true } as never)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: { added: 3, scanned: 3 } })
    expect(fetchRecentLeads).toHaveBeenCalledTimes(2)
    expect(fetchRecentLeads).toHaveBeenCalledWith('A', 30)
    expect(fetchRecentLeads).toHaveBeenCalledWith('C', 30)
    expect(fetchRecentLeads).not.toHaveBeenCalledWith('B', 30)
  })

  it('returns the auth failure and does no work when unauthorized', async () => {
    vi.mocked(requireAuth).mockResolvedValue({ success: false, error: 'Unauthorized' } as never)

    const result = await reconcileLeads()

    expect(result).toEqual({ success: false, error: 'Unauthorized' })
    expect(listLeadForms).not.toHaveBeenCalled()
    expect(storeLead).not.toHaveBeenCalled()
  })

  it('skips a lead that fails schema validation (not scanned, not stored)', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([{ garbage: true }])

    const result = await reconcileLeads()

    expect(result).toEqual({ success: true, data: { added: 0, scanned: 0 } })
    expect(storeLead).not.toHaveBeenCalled()
  })
})
