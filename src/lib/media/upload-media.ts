import { ROUTE_BODY_MAX_BYTES } from '@/lib/constants/route-body'
import { uploadMediaFromClient } from '@/lib/media/client-upload'
import { mediaIdFrom } from '@/lib/media/media-route-response'
import { refused } from '@/lib/media/upload-refused'
import { uploadFileProblem } from '@/lib/media/validate-upload-file'
import type { MediaKindT } from '@/types/media'

const FAST_ROUTE = '/api/media-upload'

async function uploadMediaToServer(file: File, kind?: MediaKindT): Promise<number> {
  const formData = new FormData()
  formData.set('file', file)
  if (kind) formData.set('kind', kind)

  const response = await fetch(FAST_ROUTE, { method: 'POST', body: formData })
  return mediaIdFrom(response, FAST_ROUTE, file)
}

/**
 * The fast path for what fits under a function's body cap, the browser-to-Blob path for the rest.
 * Chosen by size, not type: a 100 KB PDF e-faktura belongs on the fast path as much as a photo.
 */
export async function uploadMediaBySize(file: File, kind?: MediaKindT): Promise<number> {
  const problem = uploadFileProblem(file)
  if (problem) throw refused(problem)

  return file.size <= ROUTE_BODY_MAX_BYTES
    ? uploadMediaToServer(file, kind)
    : uploadMediaFromClient(file, kind)
}
