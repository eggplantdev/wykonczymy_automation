import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from './store-lead'
import { notifyNewLead, sendAutoReply } from './notify'

const NOTIFY_ATTEMPTS = 3

/** Retry an email send a few times; a transient SMTP blip shouldn't cost the message. */
async function sendWithRetry(send: () => Promise<void>, label: string): Promise<boolean> {
  for (let attempt = 1; attempt <= NOTIFY_ATTEMPTS; attempt += 1) {
    try {
      await send()
      return true
    } catch (err) {
      console.error(`[capture-lead] ${label} attempt ${attempt}/${NOTIFY_ATTEMPTS} failed`, err)
    }
  }
  return false
}

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

  // Internal heads-up to the sales inbox.
  const notified = await sendWithRetry(() => notifyNewLead(payload, lead), 'notify')

  // Customer-facing confirmation. Skipped (no send) for phone-only leads and for
  // Meta's test submissions — never email a fake `<test lead:>` address.
  const canAutoReply = Boolean(lead.email) && !lead.isTest
  const autoReplyStatus: Lead['autoReplyStatus'] = !canAutoReply
    ? 'skipped'
    : (await sendWithRetry(() => sendAutoReply(payload, lead), 'auto-reply'))
      ? 'sent'
      : 'failed'

  await payload.update({
    collection: 'leads',
    id: lead.id,
    data: {
      notifyStatus: notified ? 'sent' : 'failed',
      autoReplyStatus,
    },
    overrideAccess: true,
  })

  return { lead, created }
}
