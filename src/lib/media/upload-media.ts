import { ROUTE_BODY_MAX_BYTES } from '@/lib/constants/route-body'
import { uploadMediaFromClient } from '@/lib/media/client-upload'
import { refused } from '@/lib/media/upload-refused'
import { logError } from '@/lib/utils/log-error'
import { uploadFileProblem } from '@/lib/utils/validate-upload-file'
import type { MediaKindT } from '@/types/media'

const FAST_ROUTE = '/api/media-upload'

const REFUSED_STATUSES = new Set([400, 413, 415])

/**
 * Refusals use the keys `uploadMediaFromClient` throws, so the toast reads the same whichever path
 * a file took.
 */
export async function uploadMediaToServer(
  file: File,
  data: { kind?: MediaKindT } = {},
): Promise<number> {
  const problem = uploadFileProblem(file)
  if (problem) throw refused(problem)

  const formData = new FormData()
  formData.set('file', file)
  if (data.kind) formData.set('kind', data.kind)

  const response = await fetch(FAST_ROUTE, { method: 'POST', body: formData })
  const body = await response.json().catch(() => undefined)

  if (!response.ok) {
    logError(`[upload-media] POST ${FAST_ROUTE} ${response.status}`, body?.error)
    throw REFUSED_STATUSES.has(response.status)
      ? refused('uploadRejected', { name: file.name })
      : refused('uploadSaveFailed', { name: file.name, status: response.status })
  }
  const id = body?.id
  if (typeof id !== 'number') throw refused('uploadNoFileReturned')
  return id
}

/**
 * The fast path for what fits under a function's body cap, the browser-to-Blob path for the rest.
 * Chosen by size, not type: a 100 KB PDF e-faktura belongs on the fast path as much as a photo.
 */
export function uploadMediaBySize(file: File, data: { kind?: MediaKindT } = {}): Promise<number> {
  return file.size <= ROUTE_BODY_MAX_BYTES
    ? uploadMediaToServer(file, data)
    : uploadMediaFromClient(file, data)
}
