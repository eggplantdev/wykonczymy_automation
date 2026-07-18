import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from './store-lead'
import { notifyNewLead, sendAutoReply } from './notify'
import { logError } from '@/lib/utils/log-error'

const NOTIFY_ATTEMPTS = 3

/** Retry an email send a few times; a transient SMTP blip shouldn't cost the message. */
async function sendWithRetry(send: () => Promise<void>, label: string): Promise<boolean> {
  for (let attempt = 1; attempt <= NOTIFY_ATTEMPTS; attempt += 1) {
    try {
      await send()
      return true
    } catch (err) {
      logError(`[capture-lead] ${label} attempt ${attempt}/${NOTIFY_ATTEMPTS} failed`, err)
    }
  }
  return false
}

/**
 * Store-then-notify: the ordering is load-bearing. The lead is persisted BEFORE
 * any email is attempted, so a mail failure can never lose it — it only flips
 * the channel's status to `failed`.
 *
 * `storeLead` writes both statuses `pending` on create, so `pending` means
 * "never attempted". On a fresh create we run both channels. On a redelivery
 * (`created === false`) we retry ONLY the channels still `pending` — the case
 * where a crash between store and status-write left them stuck — while leaving a
 * settled channel (`sent`/`failed`/`skipped`) untouched, so Meta's retries never
 * re-send an email that already went out.
 *
 * Each send is retried up to NOTIFY_ATTEMPTS times before giving up — a transient
 * SMTP blip shouldn't cost the message. Only the final failure flips to `failed`.
 */
export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
): Promise<{ lead: Lead; created: boolean }> {
  const { lead, created } = await storeLead(payload, input)

  const runNotify = created || lead.notifyStatus === 'pending'
  const runAutoReply = created || lead.autoReplyStatus === 'pending'
  if (!runNotify && !runAutoReply) return { lead, created }

  // Internal heads-up to the sales inbox.
  const notifyStatus: Lead['notifyStatus'] = runNotify
    ? (await sendWithRetry(() => notifyNewLead(payload, lead), 'notify'))
      ? 'sent'
      : 'failed'
    : lead.notifyStatus

  // Customer-facing confirmation. Skipped (no send) for phone-only leads.
  const canAutoReply = Boolean(lead.email)
  const autoReplyStatus: Lead['autoReplyStatus'] = runAutoReply
    ? !canAutoReply
      ? 'skipped'
      : (await sendWithRetry(() => sendAutoReply(payload, lead), 'auto-reply'))
        ? 'sent'
        : 'failed'
    : lead.autoReplyStatus

  await payload.update({
    collection: 'leads',
    id: lead.id,
    data: { notifyStatus, autoReplyStatus },
    overrideAccess: true,
  })

  return { lead, created }
}
