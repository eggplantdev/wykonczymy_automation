import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Unit test for the sweep core shared by the „Pobierz zgłoszenia" action and the daily
// cron. The Graph fetch and capture seams are mocked; lead-schema + normalize-lead stay
// real so the parse/normalize path is exercised.
const { update } = vi.hoisted(() => ({ update: vi.fn() }))

vi.mock('@/lib/leads/fetch-recent-leads', () => ({
  listLeadForms: vi.fn(),
  fetchRecentLeads: vi.fn(),
}))
vi.mock('@/lib/leads/fetch-form', () => ({ fetchForm: vi.fn() }))
vi.mock('@/lib/leads/capture-lead', () => ({ captureLead: vi.fn() }))

import { runLeadReconcileSweep, PER_FORM_LIMIT } from '@/lib/leads/reconcile-sweep'
import { listLeadForms, fetchRecentLeads } from '@/lib/leads/fetch-recent-leads'
import { fetchForm } from '@/lib/leads/fetch-form'
import { captureLead } from '@/lib/leads/capture-lead'
import type { Payload } from 'payload'

// Fabricated, PII-free. 'adres_e-mail' key → email via normalizeLead's heuristic.
const rawLead = (id: string) => ({
  id,
  created_time: '2026-07-08T07:09:14+0000',
  field_data: [{ name: 'adres_e-mail', values: [`${id}@example.com`] }],
})

const form = (id: string, leadsCount: number) => ({ id, name: `form-${id}`, leadsCount })

const payload = { update } as unknown as Payload

const clean = { failedForms: [], saturatedForms: [] }

// Most cases care only about how many leads came back — the shape of a recovered row
// gets its own case below.
const counts = (result: Awaited<ReturnType<typeof runLeadReconcileSweep>>) => ({
  added: result.recovered.length,
  scanned: result.scanned,
  failedForms: result.failedForms,
  saturatedForms: result.saturatedForms,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(fetchForm).mockResolvedValue({ questions: [] })
  update.mockResolvedValue(undefined)
})

describe('runLeadReconcileSweep', () => {
  // The whole point of EX-660: a recovered lead goes through the normal capture path, so
  // sales is notified like any other lead. Only the customer-facing reply is suppressed —
  // and the sweep writes no statuses of its own, because it cannot know what was sent.
  it('captures a missing lead with the auto-reply suppressed and stamps nothing itself', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(captureLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(counts(result)).toEqual({ added: 1, scanned: 1, ...clean })
    expect(captureLead).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        source: 'facebook_lead_ads',
        externalId: '1',
        email: '1@example.com',
        formId: 'A',
        formName: 'form-A',
      }),
      { autoReply: 'skip', skipRevalidation: true },
    )
    expect(update).not.toHaveBeenCalled()
  })

  // Sales already got a per-lead notification, so this list is an audit trail for the ops
  // alert — contact details would only duplicate what the notify mail already carried.
  it('returns each recovered lead as an audit row without contact details', async () => {
    const stored = {
      id: 11,
      name: 'Jan Testowy',
      email: '1@example.com',
      phone: '+48100000000',
      formName: 'form-A',
      submittedAt: '2026-07-08T07:09:14.000Z',
      rawData: {},
    }
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(captureLead).mockResolvedValue({ lead: stored, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result.recovered).toEqual([
      {
        id: 11,
        name: 'Jan Testowy',
        formName: 'form-A',
        submittedAt: '2026-07-08T07:09:14.000Z',
      },
    ])
  })

  it('leaves an already-stored lead out of the added count', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(captureLead).mockResolvedValue({ lead: { id: 11 }, created: false } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(counts(result)).toEqual({ added: 0, scanned: 1, ...clean })
    expect(update).not.toHaveBeenCalled()
  })

  it('sweeps every non-empty form and skips forms with zero leads', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 2), form('B', 0), form('C', 5)])
    vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) =>
      formId === 'A' ? [rawLead('a1'), rawLead('a2')] : formId === 'C' ? [rawLead('c1')] : [],
    )
    vi.mocked(captureLead).mockResolvedValue({ lead: { id: 99 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(counts(result)).toEqual({ added: 3, scanned: 3, ...clean })
    expect(fetchRecentLeads).toHaveBeenCalledTimes(2)
    expect(fetchRecentLeads).toHaveBeenCalledWith('A', PER_FORM_LIMIT)
    expect(fetchRecentLeads).toHaveBeenCalledWith('C', PER_FORM_LIMIT)
    expect(fetchRecentLeads).not.toHaveBeenCalledWith('B', PER_FORM_LIMIT)
  })

  it('skips a lead that fails schema validation (not scanned, not stored)', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([{ garbage: true }])

    const result = await runLeadReconcileSweep(payload)

    expect(counts(result)).toEqual({ added: 0, scanned: 0, ...clean })
    expect(captureLead).not.toHaveBeenCalled()
  })

  it('propagates a failure to list the forms — nothing could be swept at all', async () => {
    vi.mocked(listLeadForms).mockRejectedValue(new Error('Graph request failed'))

    await expect(runLeadReconcileSweep(payload)).rejects.toThrow('Graph request failed')
  })

  describe('partial failure', () => {
    let consoleError: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
      consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      consoleError.mockRestore()
    })

    // Form order is stable, so a throw would mean the forms after the broken one are
    // never swept on any day — and the leads already stored would lose their alert.
    it('keeps sweeping after a form fails and reports it instead of throwing', async () => {
      vi.mocked(listLeadForms).mockResolvedValue([form('A', 1), form('B', 1), form('C', 1)])
      vi.mocked(fetchRecentLeads).mockImplementation(async (formId: string) => {
        if (formId === 'B') throw new Error('rate limited')
        return [rawLead(formId)]
      })
      vi.mocked(captureLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

      const result = await runLeadReconcileSweep(payload)

      expect(counts(result)).toEqual({
        added: 2,
        scanned: 2,
        failedForms: ['B'],
        saturatedForms: [],
      })
      expect(fetchRecentLeads).toHaveBeenCalledWith('C', PER_FORM_LIMIT)
    })

    it('reports a form that failed on its questions fetch, after the leads came back', async () => {
      vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
      vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
      vi.mocked(fetchForm).mockRejectedValue(new Error('rate limited'))

      const result = await runLeadReconcileSweep(payload)

      expect(counts(result)).toEqual({
        added: 0,
        scanned: 0,
        failedForms: ['A'],
        saturatedForms: [],
      })
      expect(captureLead).not.toHaveBeenCalled()
    })
  })

  // A full page means the window decided where we stopped, not the backlog. Tomorrow's
  // page is a newer set, so anything past the limit is lost unless somebody is told.
  it('flags a form that filled a whole page as saturated', async () => {
    const fullPage = Array.from({ length: PER_FORM_LIMIT }, (_, index) => rawLead(`a${index}`))
    vi.mocked(listLeadForms).mockResolvedValue([form('A', PER_FORM_LIMIT + 15)])
    vi.mocked(fetchRecentLeads).mockResolvedValue(fullPage)
    vi.mocked(captureLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(counts(result)).toEqual({
      added: PER_FORM_LIMIT,
      scanned: PER_FORM_LIMIT,
      failedForms: [],
      saturatedForms: ['A'],
    })
  })

  it('does not flag a form whose page came back short of the limit', async () => {
    vi.mocked(listLeadForms).mockResolvedValue([form('A', 1)])
    vi.mocked(fetchRecentLeads).mockResolvedValue([rawLead('1')])
    vi.mocked(captureLead).mockResolvedValue({ lead: { id: 11 }, created: true } as never)

    const result = await runLeadReconcileSweep(payload)

    expect(result.saturatedForms).toEqual([])
  })
})
