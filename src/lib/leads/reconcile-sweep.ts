import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { listLeadForms, fetchRecentLeads } from './fetch-recent-leads'
import { fetchForm } from './fetch-form'
import { leadSchema } from './lead-schema'
import { normalizeLead } from './normalize-lead'
import { captureLead } from './capture-lead'

// The sweep sees a form's N most recent
// leads and tomorrow's page is a newer set, so anything past N is gone for good.
export const PER_FORM_LIMIT = 100

export type RecoveredLeadT = Pick<Lead, 'id' | 'name' | 'formName' | 'submittedAt'>

export type ReconcileSweepResultT = {
  recovered: RecoveredLeadT[]
  scanned: number
  failedForms: string[]
  /** Forms whose full `PER_FORM_LIMIT` page ended on a new lead — older ones may lie past it. */
  saturatedForms: string[]
}

/**
 * Partial failure is reported, not thrown: form order is stable, so a throw would discard the leads
 * already recovered and leave the tail unswept on every day.
 */
export async function runLeadReconcileSweep(payload: Payload): Promise<ReconcileSweepResultT> {
  const forms = await listLeadForms()

  const recovered: RecoveredLeadT[] = []
  let scanned = 0
  const failedForms: string[] = []
  const saturatedForms: string[] = []

  for (const form of forms) {
    if (form.leadsCount === 0) continue

    try {
      const rawLeads = await fetchRecentLeads(form.id, PER_FORM_LIMIT)
      if (rawLeads.length === 0) continue

      const { questions } = await fetchForm(form.id)
      let oldest: { time: number; created: boolean } | undefined

      for (const raw of rawLeads) {
        const parsed = leadSchema.safeParse(raw)
        if (!parsed.success) continue
        scanned += 1

        const normalized = normalizeLead(parsed.data.field_data, questions)
        const { lead, created } = await captureLead(
          payload,
          {
            source: 'facebook_lead_ads',
            externalId: parsed.data.id,
            email: normalized.email,
            name: normalized.name,
            phone: normalized.phone,
            rawData: normalized.rawData,
            formQuestions: questions,
            formId: form.id,
            formName: form.name,
            submittedAt: parsed.data.created_time,
          },
          {
            autoReply: 'skip',
            skipRevalidation: true,
          },
        )

        const time = Date.parse(parsed.data.created_time)
        if (!oldest || time < oldest.time) oldest = { time, created }

        if (!created) continue

        recovered.push({
          id: lead.id,
          name: lead.name,
          formName: lead.formName,
          submittedAt: lead.submittedAt,
        })
      }

      // Decided by the page's OLDEST lead alone: a dormant form fills the page with old ones and ends on
      // a stored lead, so it stays quiet.
      if (rawLeads.length >= PER_FORM_LIMIT && oldest?.created) saturatedForms.push(form.id)
    } catch (err) {
      // TODO(EX-958) SENTRY-REQUIRED: a form the sweep can never read is a permanent hole.
      console.error(`[reconcile-sweep] Form ${form.id} failed`, err)
      failedForms.push(form.id)
    }
  }

  return { recovered, scanned, failedForms, saturatedForms }
}
