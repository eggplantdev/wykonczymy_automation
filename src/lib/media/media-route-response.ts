import { refused } from '@/lib/media/upload-refused'
import { logError } from '@/lib/utils/log-error'

// What the route refuses about the file itself; anything else is the save failing, worth a retry.
const REFUSED_STATUSES = new Set([400, 409, 413, 415])

/**
 * The row id from either of our upload routes, or a refusal worded for the toast — the caller puts
 * `err.message` in front of the user, so an `ok` response with an unparseable body (an edge
 * interstitial) must not surface as a bare TypeError.
 */
export async function mediaIdFrom(response: Response, route: string, file: File): Promise<number> {
  const body = await response.json().catch(() => undefined)

  if (!response.ok) {
    logError(`[upload-media] POST ${route} ${response.status}`, body?.error)
    throw REFUSED_STATUSES.has(response.status)
      ? refused('uploadRejected', { name: file.name })
      : refused('uploadSaveFailed', { name: file.name, status: response.status })
  }
  const id = body?.id
  if (typeof id !== 'number') throw refused('uploadNoFileReturned')
  return id
}
