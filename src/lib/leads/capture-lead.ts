import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from './store-lead'
import { notifyNewLead } from './notify'

/**
 * Store-then-notify: the ordering is load-bearing. The lead is persisted BEFORE
 * any email is attempted, so a mail failure can never lose it — it only flips
 * `notifyStatus` to `failed`. A redelivered lead (`created === false`) is not
 * re-notified: no duplicate email on Meta's retries.
 */
export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
): Promise<{ lead: Lead; created: boolean }> {
  const { lead, created } = await storeLead(payload, input)
  if (!created) return { lead, created }

  try {
    await notifyNewLead(payload, lead)
    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: { notifyStatus: 'sent' },
      overrideAccess: true,
    })
  } catch {
    await payload.update({
      collection: 'leads',
      id: lead.id,
      data: { notifyStatus: 'failed' },
      overrideAccess: true,
    })
  }

  return { lead, created }
}
