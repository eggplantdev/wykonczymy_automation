import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'

export type StoreLeadInputT = {
  source: 'facebook_lead_ads'
  externalId?: string
  email?: string
  name?: string
  phone?: string
  rawData: LeadFieldT[]
  formQuestions?: LeadFormQuestionT[]
  formId?: string
  formName?: string
  submittedAt?: string
  isTest: boolean
}

/** The already-stored sibling for this `(source, externalId)`, or undefined. */
async function findExisting(payload: Payload, input: StoreLeadInputT): Promise<Lead | undefined> {
  if (!input.externalId) return undefined
  const existing = await payload.find({
    collection: 'leads',
    where: {
      and: [{ source: { equals: input.source } }, { externalId: { equals: input.externalId } }],
    },
    limit: 1,
    overrideAccess: true,
  })
  return existing.docs[0]
}

/**
 * Persist a normalized lead exactly once per `(source, externalId)`.
 *
 * Meta redelivers the same `leadgen_id` on retry, so a naive create would
 * duplicate. We look up first and return the existing row untouched when found
 * (`created: false`) — the caller uses that flag to skip re-notifying. A missing
 * `externalId` can't be deduped, so it always creates (the compound unique index
 * tolerates NULLs).
 *
 * The find-then-create is not atomic: two concurrent redeliveries of the same
 * leadgen_id can both pass the lookup and race to create. The compound unique
 * index is the real guard — the loser's `create` throws. We catch that, re-read
 * the winner, and return it as `created: false` rather than surfacing a spurious
 * 500. Only rethrow if the row still isn't there (a genuine, non-race failure).
 */
// `skipRevalidation` lets a non-request caller (backfill script) bypass the
// collection's afterChange revalidateTag hook, which throws outside a Next request.
export async function storeLead(
  payload: Payload,
  input: StoreLeadInputT,
  options?: { skipRevalidation?: boolean },
): Promise<{ lead: Lead; created: boolean }> {
  const existing = await findExisting(payload, input)
  if (existing) return { lead: existing, created: false }

  const data = {
    source: input.source,
    externalId: input.externalId,
    email: input.email,
    name: input.name,
    phone: input.phone,
    rawData: input.rawData,
    formQuestions: input.formQuestions,
    formId: input.formId,
    formName: input.formName,
    submittedAt: input.submittedAt,
    isTest: input.isTest,
    // Required selects — captureLead flips notifyStatus after the send attempt.
    contactStatus: 'new' as const,
    notifyStatus: 'pending' as const,
    autoReplyStatus: 'pending' as const,
  }

  try {
    const lead = await payload.create({
      collection: 'leads',
      data,
      overrideAccess: true,
      context: { skipRevalidation: options?.skipRevalidation ?? false },
    })
    return { lead, created: true }
  } catch (err) {
    // Lost the unique-index race with a concurrent redelivery? The winner's row
    // now exists — return it. Otherwise this is a real failure; let it propagate.
    const winner = await findExisting(payload, input)
    if (winner) return { lead: winner, created: false }
    throw err
  }
}
