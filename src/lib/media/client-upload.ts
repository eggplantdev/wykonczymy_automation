import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { mediaIdFrom } from '@/lib/media/media-route-response'
import type { MediaKindT } from '@/types/media'

const TOKEN_ROUTE = '/api/vercel-blob-client-upload-route'
const REGISTER_ROUTE = '/api/media-register'

/**
 * The name is minted here because the blob key and the row's `filename` have to be the same string.
 */
export async function uploadMediaFromClient(file: File, kind?: MediaKindT): Promise<number> {
  const filename = uniqueFileName(file.name)

  // Lazy so the ~30 KB SDK stays out of the forms that merely import this module
  const { upload } = await import('@vercel/blob/client')
  await upload(filename, file, {
    access: 'public',
    contentType: file.type,
    clientPayload: 'media',
    handleUploadUrl: TOKEN_ROUTE,
  })

  const response = await fetch(REGISTER_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename, kind }),
  })
  return mediaIdFrom(response, REGISTER_ROUTE, file)
}
