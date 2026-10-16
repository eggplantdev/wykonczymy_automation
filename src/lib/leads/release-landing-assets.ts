import { serverEnv } from '@/lib/env/server'
import { signBody } from '@/lib/leads/verify-signature'
import { logError } from '@/lib/utils/log-error'

const TIMEOUT_MS = 10_000

/**
 * Called only once `payload.update` has
 * committed the attach — because until the media rows are
 * referenced by the lead, our copy is itself reclaimable and the landing's would be the last one.
 *
 * Carries the `submissionId` and NOTHING else. A delete instruction that names its own targets is a
 * delete primitive for whoever can forge or replay it.
 */
export async function releaseLandingAssets(submissionId: string): Promise<void> {
  // It must
  // name the landing's public alias — the project-scoped one answers 401 (Deployment Protection).
  const url = serverEnv.LANDING_CLEANUP_URL
  if (!url) return

  const body = JSON.stringify({ submissionId })

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-landing-signature': signBody(body, serverEnv.LANDING_WEBHOOK_SECRET, 'landing-cleanup'),
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
