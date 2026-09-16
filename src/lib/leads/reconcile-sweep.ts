import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { listLeadForms, fetchRecentLeads } from './fetch-recent-leads'
import { fetchForm } from './fetch-form'
import { leadSchema } from './lead-schema'
import { normalizeLead } from './normalize-lead'
import { captureLead } from './capture-lead'

// The window has to span a whole webhook blackout, not one night: the sweep only ever sees a form's
// N most recent leads, and tomorrow's page is a newer set, so anything that falls past N is gone for
// good. Sized off the busiest day ever recorded (7 leads on one form), 100 survives a two-week
// outage; a form's entire history currently fits inside it, which is why nothing is flagged saturated.
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
 * Pull the most recent leads from every form and insert any the DB is missing.
 * Reconciles against Meta directly, so it recovers leads dropped by an expired
 * token, an outage, or a mis-pointed webhook (see lessons.md — the webhook's
 * failure mode is silent).
 *
 * Backfill is silent to the CUSTOMER, never to sales. It goes through `captureLead`
 * with `autoReply: 'skip'`, so a lead recovered days late gets no „Dziękujemy za
 * kontakt" but does reach the sales inbox like any other lead. The sweep writes no
 * statuses itself: it cannot know whether sales was told, so it has no business
 * recording that decision (EX-660 — it used to stamp `notifyStatus: 'skipped'`, which
 * is terminal, and silently buried every lead the webhook had dropped).
 *
 * Free of auth and cache revalidation — the cron route supplies its own.
 *
 * Partial failure is reported, not thrown: one form's rate-limit must not discard
 * the leads already recovered from earlier forms, nor skip the forms after it —
 * form order is stable, so a throw here would mean the tail is never swept on any
 * day. Only a failure to list the forms at all throws.
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

      // A full page means the window, not the backlog, decided where we stopped —
      // the leads past it are unreachable and tomorrow's page is a newer set, so
      // they would be lost silently. The caller surfaces this in the alert.
      if (rawLeads.length >= PER_FORM_LIMIT) saturatedForms.push(form.id)

      // One form fetch per form — carries Meta's field types for normalizeLead. The name comes
      // from the forms listing here, so only the questions are read off it.
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
            // The afterChange hook's revalidateTag is redundant here — the caller does
            // one revalidation after the whole sweep instead.
            skipRevalidation: true,
          },
        )

        // Guards the `recovered` list only. A redelivered row's unsent channels are
        // `captureLead`'s business, and it has already dealt with them by this point.
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
