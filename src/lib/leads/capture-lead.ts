import type { Payload } from 'payload'
import type { Lead } from '@/payload-types'
import { storeLead, type StoreLeadInputT } from './store-lead'
import { notifyNewLead, sendAutoReply } from './notify'
import { logError } from '@/lib/utils/log-error'

const NOTIFY_ATTEMPTS = 3

export type CaptureLeadOptionsT = {
  /**
   * `'skip'` settles the customer-facing channel as `skipped` without sending — for a
   * backfill, where a days-late „Dziękujemy za kontakt" is worse than none at all.
   *
   * There is deliberately no matching option for the sales notify. The asymmetry is the
   * point: a late heads-up to sales is still useful (a week-old lead is still a lead),
   * while a late auto-reply to a customer is embarrassing. Only the auto-reply is a
   * decision a caller can legitimately make; letting a caller suppress `notify` would
   * re-open EX-660, where the sweep wrote a terminal state it had no authority to write.
   */
  autoReply?: 'send' | 'skip'
  /** Bypasses the collection's afterChange revalidateTag hook — for callers that batch
   *  their own revalidation, or run outside a Next request where the hook throws. */
  skipRevalidation?: boolean
  /**
   * How many files the submission announced. Only the landing has this: it hands the lead over
   * BEFORE downloading them, so at notify time nothing readable from the row can say whether the
   * enquiry came with photos. Passed straight through to the mail.
   */
  expectedAssets?: number
}

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
 *
 * Every path into `leads` goes through here, backfills included, so the status writes
 * have a single owner. See `CaptureLeadOptionsT` for what a caller may vary.
 */
export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
  options: CaptureLeadOptionsT = {},
): Promise<{ lead: Lead; created: boolean }> {
  const { autoReply = 'send', skipRevalidation = false, expectedAssets } = options
  const { lead, created } = await storeLead(payload, input, { skipRevalidation })

  const runNotify = created || lead.notifyStatus === 'pending'
  const runAutoReply = created || lead.autoReplyStatus === 'pending'
  if (!runNotify && !runAutoReply) return { lead, created }

  // Internal heads-up to the sales inbox.
  const notifyStatus: Lead['notifyStatus'] = runNotify
    ? (await sendWithRetry(() => notifyNewLead(payload, lead, { expectedAssets }), 'notify'))
      ? 'sent'
      : 'failed'
    : lead.notifyStatus

  // Customer-facing confirmation. Two unrelated reasons land on the same `skipped`
  // status — no address to reach them at, or a caller that says it's too late to reply.
  const canAutoReply = autoReply === 'send' && Boolean(lead.email)
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
    context: { skipRevalidation },
  })

  return { lead, created }
}
