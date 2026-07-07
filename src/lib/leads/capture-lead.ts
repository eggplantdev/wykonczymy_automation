import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from './store-lead'
import { notifyNewLead } from './notify'

const NOTIFY_ATTEMPTS = 3

/**
 * Store-then-notify: the ordering is load-bearing. The lead is persisted BEFORE
 * any email is attempted, so a mail failure can never lose it — it only flips
 * `notifyStatus` to `failed`. A redelivered lead (`created === false`) is not
 * re-notified: no duplicate email on Meta's retries.
 *
 * The email send is retried up to NOTIFY_ATTEMPTS times before giving up — a
 * transient SMTP blip shouldn't cost the heads-up. Only the final failure flips
 * the status to `failed`.
 */
export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
): Promise<{ lead: Lead; created: boolean }> {
  const { lead, created } = await storeLead(payload, input)
  if (!created) return { lead, created }

  let notifyStatus: 'sent' | 'failed' = 'failed'
  for (let attempt = 1; attempt <= NOTIFY_ATTEMPTS; attempt += 1) {
    try {
      await notifyNewLead(payload, lead)
      notifyStatus = 'sent'
      break
    } catch (err) {
      console.error(`[capture-lead] notify attempt ${attempt}/${NOTIFY_ATTEMPTS} failed`, err)
    }
  }

  await payload.update({
    collection: 'leads',
    id: lead.id,
    data: { notifyStatus },
    overrideAccess: true,
  })

  return { lead, created }
}
