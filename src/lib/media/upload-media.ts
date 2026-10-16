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

export async function uploadMediaBySize(file: File, kind?: MediaKindT): Promise<number> {
  const problem = uploadFileProblem(file)
  if (problem) throw refused(problem)

  return file.size <= ROUTE_BODY_MAX_BYTES
    ? uploadMediaToServer(file, kind)
    : uploadMediaFromClient(file, kind)
}
