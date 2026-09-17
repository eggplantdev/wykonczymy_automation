import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { listLeadForms, fetchRecentLeads } from './fetch-recent-leads'
import { fetchForm } from './fetch-form'
import { leadSchema } from './lead-schema'
import { normalizeLead } from './normalize-lead'
import { captureLead } from './capture-lead'

// The window spans a whole webhook blackout, not one night: the sweep sees a form's N most recent
// leads and tomorrow's page is a newer set, so anything past N is gone for good. Off the busiest day
// recorded (7 leads on one form), 100 survives a two-week outage.
export const PER_FORM_LIMIT = 100

/** An audit trail for the ops alert, not a call list — sales already got the lead itself. */
export type RecoveredLeadT = Pick<Lead, 'id' | 'name' | 'formName' | 'submittedAt'>

export type ReconcileSweepResultT = {
  /** The leads this run actually inserted. Its length is the `added` count. */
  recovered: RecoveredLeadT[]
  scanned: number
  /** Forms whose Graph calls threw; the rest of the sweep still ran. */
  failedForms: string[]
  /** Forms that filled a whole `PER_FORM_LIMIT` page — older leads may lie past it. */
  saturatedForms: string[]
}

/**
 * Reconciles against Meta directly, so it recovers leads dropped by an expired token, an outage or a
 * mis-pointed webhook — whose failure mode is silent (lessons.md).
 *
 * Backfill is silent to the CUSTOMER, never to sales: `autoReply: 'skip'` means a lead recovered days
 * late gets no „Dziękujemy za kontakt" but still reaches the sales inbox. The sweep writes no
 * statuses — it cannot know whether sales was told (EX-660).
 *
 * Free of auth and cache revalidation; the cron route supplies its own.
 *
 * Partial failure is reported, not thrown: form order is stable, so a throw would discard the leads
 * already recovered and leave the tail unswept on every day. Only failing to list the forms throws.
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

      // A full page means the window, not the backlog, decided where we stopped, and the leads past
      // it are unreachable. The caller surfaces this in the alert.
      if (rawLeads.length >= PER_FORM_LIMIT) saturatedForms.push(form.id)

      // Carries Meta's field types for normalizeLead; the name comes from the forms listing.
      const { questions } = await fetchForm(form.id)

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
            // The caller revalidates once after the whole sweep.
            skipRevalidation: true,
          },
        )

        // Guards the `recovered` list only — a redelivered row's unsent channels are `captureLead`'s
        // business and it has dealt with them by now.
        if (!created) continue

        recovered.push({
          id: lead.id,
          name: lead.name,
          formName: lead.formName,
          submittedAt: lead.submittedAt,
        })
      }
    } catch (err) {
      // TODO(EX-449) SENTRY-REQUIRED: a form the sweep can never read is a permanent hole.
      console.error(`[reconcile-sweep] Form ${form.id} failed`, err)
      failedForms.push(form.id)
    }
  }

  return { recovered, scanned, failedForms, saturatedForms }
}
