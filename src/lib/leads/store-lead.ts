import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import type { LeadFieldT } from './lead-schema'

export type StoreLeadInputT = {
  source: 'facebook_lead_ads'
  externalId?: string
  email?: string
  name?: string
  phone?: string
  rawData: LeadFieldT[]
  formId?: string
  formName?: string
  submittedAt?: string
  isTest: boolean
}

/**
 * Persist a normalized lead exactly once per `(source, externalId)`.
 *
 * Meta redelivers the same `leadgen_id` on retry, so a naive create would
 * duplicate. We look up first and return the existing row untouched when found
 * (`created: false`) — the caller uses that flag to skip re-notifying. A missing
 * `externalId` can't be deduped, so it always creates (the compound unique index
 * tolerates NULLs).
 */
// `skipRevalidation` lets a non-request caller (backfill script) bypass the
// collection's afterChange revalidateTag hook, which throws outside a Next request.
export async function storeLead(
  payload: Payload,
  input: StoreLeadInputT,
  options?: { skipRevalidation?: boolean },
): Promise<{ lead: Lead; created: boolean }> {
  if (input.externalId) {
    const existing = await payload.find({
      collection: 'leads',
      where: {
        and: [{ source: { equals: input.source } }, { externalId: { equals: input.externalId } }],
      },
      limit: 1,
      overrideAccess: true,
    })
    const found = existing.docs[0]
    if (found) return { lead: found, created: false }
  }

  const lead = await payload.create({
    collection: 'leads',
    data: {
      source: input.source,
      externalId: input.externalId,
      email: input.email,
      name: input.name,
      phone: input.phone,
      rawData: input.rawData,
      formId: input.formId,
      formName: input.formName,
      submittedAt: input.submittedAt,
      isTest: input.isTest,
      // Required selects — captureLead flips notifyStatus after the send attempt.
      contactStatus: 'new',
      notifyStatus: 'pending',
      autoReplyStatus: 'pending',
    },
    overrideAccess: true,
    context: { skipRevalidation: options?.skipRevalidation ?? false },
  })

  return { lead, created: true }
}
