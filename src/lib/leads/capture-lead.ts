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
   */
  autoReply?: 'send' | 'skip'
  /** Bypasses the collection's afterChange revalidateTag hook — for callers that batch
   *  their own revalidation, or run outside a Next request where the hook throws. */
  skipRevalidation?: boolean
  expectedAssets?: number
}

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
 * The lead is persisted BEFORE any email is attempted, so a mail failure can never lose it — it
 * only flips the channel's status to `failed`.
 */
export async function captureLead(
  payload: Payload,
  input: StoreLeadInputT,
  options: CaptureLeadOptionsT = {},
): Promise<{ lead: Lead; created: boolean }> {
  const { autoReply = 'send', skipRevalidation = false, expectedAssets } = options
  const { lead, created } = await storeLead(payload, input, { skipRevalidation })
  // A tombstone's statuses were never reset, so a `pending` one would mail sales an empty lead.
  if (!created && lead.erasedAt) return { lead, created }

  const runNotify = created || lead.notifyStatus === 'pending'
  const runAutoReply = created || lead.autoReplyStatus === 'pending'
  if (!runNotify && !runAutoReply) return { lead, created }

  const notifyStatus: Lead['notifyStatus'] = runNotify
    ? (await sendWithRetry(() => notifyNewLead(payload, lead, { expectedAssets }), 'notify'))
      ? 'sent'
      : 'failed'
    : lead.notifyStatus

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
