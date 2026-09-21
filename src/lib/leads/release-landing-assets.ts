import { serverEnv } from '@/lib/env/server'
import { signBody } from '@/lib/leads/verify-signature'
import { logError } from '@/lib/utils/log-error'

const TIMEOUT_MS = 10_000

/**
 * Tell the landing that a submission's files are safely ours, so it can drop its own copies.
 *
 * The bytes reach us by being uploaded to the LANDING's blob store first; that copy is a staging
 * area whose whole life is „until the other side has it". Called only once `payload.update` has
 * committed the attach — not merely once the download succeeded — because until the media rows are
 * referenced by the lead, our copy is itself reclaimable and the landing's would be the last one.
 *
 * Carries the `submissionId` and NOTHING else. A delete instruction that names its own targets is a
 * delete primitive for whoever can forge or replay it; one that names a submission can only ever
 * destroy files of a submission that was already delivered — the landing re-derives the list from
 * its own `leads/<submissionId>/` prefix. Signed with the same HMAC scheme as the inbound webhook,
 * so the landing can refuse a forgery at all.
 *
 * Never throws and never fails the webhook: the enquiry is already stored and its assets already
 * attached, so a landing that is down must not turn a delivered submission into a retried one. The
 * cost of a missed callback is an orphaned prefix, which the landing's own age sweep reclaims.
 */
export async function releaseLandingAssets(submissionId: string): Promise<void> {
  // Absent while the landing half is unbuilt. The webhook is useful without it, so a missing URL is
  // a skipped callback rather than a failed delivery.
  const url = serverEnv.LANDING_CLEANUP_URL
  if (!url) return

  const body = JSON.stringify({ submissionId })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-landing-signature': signBody(body, serverEnv.LANDING_WEBHOOK_SECRET),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      logError('[landing] Cleanup callback refused', `${response.status} ${submissionId}`)
    }
  } catch (err) {
    logError('[landing] Cleanup callback failed', err)
  }
}
