'use server'

import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { revalidateCollection } from '@/lib/cache/revalidate'
import { listLeadForms, fetchRecentLeads } from '@/lib/leads/fetch-recent-leads'
import { fetchFormQuestions } from '@/lib/leads/fetch-form-questions'
import { leadSchema } from '@/lib/leads/lead-schema'
import { normalizeLead } from '@/lib/leads/normalize-lead'
import { storeLead } from '@/lib/leads/store-lead'
import type { ActionResultT } from '@/types/action'
import { getErrorMessage } from './run-action'

// How many recent leads to pull per form. Enough to close a delivery gap without
// re-scanning a form's entire history on every click.
const PER_FORM_LIMIT = 30

export type ReconcileLeadsResultT = ActionResultT<{ added: number; scanned: number }>

/**
 * Manual backstop for the webhook: pull the most recent leads from every form and
 * insert any the DB is missing. Reconciles against Meta directly, so it recovers
 * leads dropped by an expired token, an outage, or a mis-pointed webhook (see
 * lessons.md — the webhook's failure mode is silent).
 *
 * Backfill is SILENT by design: it stores via `storeLead` (never `captureLead`)
 * and stamps a fresh row's notify/auto-reply `skipped`. A lead recovered days late
 * must not trigger a "thanks for your inquiry" email, and must never re-send if the
 * webhook later redelivers the same `leadgen_id`.
 */
export async function reconcileLeads(): Promise<ReconcileLeadsResultT> {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) return session

  try {
    const payload = await getPayload({ config })
    const forms = await listLeadForms()

    let added = 0
    let scanned = 0

    for (const form of forms) {
      if (form.leadsCount === 0) continue

      const rawLeads = await fetchRecentLeads(form.id, PER_FORM_LIMIT)
      if (rawLeads.length === 0) continue

      // One questions fetch per form — carries Meta's field types for normalizeLead.
      const questions = await fetchFormQuestions(form.id)

      for (const raw of rawLeads) {
        const parsed = leadSchema.safeParse(raw)
        if (!parsed.success) continue
        scanned += 1

        const normalized = normalizeLead(parsed.data.field_data, questions)
        const { lead, created } = await storeLead(
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
          // The afterChange hook's revalidateTag is redundant here — we do one
          // action-context revalidation after the whole sweep instead.
          { skipRevalidation: true },
        )

        if (!created) continue

        await payload.update({
          collection: 'leads',
          id: lead.id,
          data: { notifyStatus: 'skipped', autoReplyStatus: 'skipped' },
          overrideAccess: true,
          // Skip the afterChange revalidateTag hook — this action does one
          // updateTag-based revalidateCollection after the whole sweep instead.
          context: { skipRevalidation: true },
        })
        added += 1
      }
    }

    if (added > 0) revalidateCollection('leads')
    return { success: true, data: { added, scanned } }
  } catch (err) {
    return { success: false, error: getErrorMessage(err) }
  }
}
