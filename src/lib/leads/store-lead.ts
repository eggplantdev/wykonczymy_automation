import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import type { LeadFieldT, LeadFormQuestionT } from './lead-schema'

export type StoreLeadInputT = {
  source: 'facebook_lead_ads' | 'website_form' | 'landing_form'
  externalId?: string
  email?: string
  name?: string
  phone?: string
  address?: string
  scope?: string
  area?: string
  rawData: LeadFieldT[]
  formQuestions?: LeadFormQuestionT[]
  formId?: string
  formName?: string
  submittedAt?: string
}

async function findStoredLead(
  payload: Payload,
  input: Pick<StoreLeadInputT, 'source' | 'externalId'>,
): Promise<Lead | undefined> {
  if (!input.externalId) return undefined
  // Unfiltered on purpose: a trashed or erased lead must still match, or a redelivery recreates it.
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

// `skipRevalidation` lets a non-request caller (backfill script) bypass the
// collection's afterChange revalidateTag hook, which throws outside a Next request.
export async function storeLead(
  payload: Payload,
  input: StoreLeadInputT,
  options?: { skipRevalidation?: boolean },
): Promise<{ lead: Lead; created: boolean }> {
  const existing = await findStoredLead(payload, input)
  if (existing) return { lead: existing, created: false }

  const data = {
    source: input.source,
    externalId: input.externalId,
    email: input.email,
    name: input.name,
    phone: input.phone,
    address: input.address,
    scope: input.scope,
    area: input.area,
    rawData: input.rawData,
    formQuestions: input.formQuestions,
    formId: input.formId,
    formName: input.formName,
    submittedAt: input.submittedAt,
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
    // now exists — return it.
    const winner = await findStoredLead(payload, input)
    if (winner) return { lead: winner, created: false }
    throw err
  }
}
