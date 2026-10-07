import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { mediaIdFrom } from '@/lib/media/media-route-response'
import type { MediaKindT } from '@/types/media'

// Registered by `vercelBlobStorage({ clientUploads })` as a Payload endpoint; it mints a
// short-lived, role-gated write token for one blob key.
const TOKEN_ROUTE = '/api/vercel-blob-client-upload-route'
const REGISTER_ROUTE = '/api/media-register'

/**
 * Upload a file too big for a function body. Two hops, because the bytes must not cross a Vercel
 * function: the browser PUTs them straight to Blob, then registers the key that just landed.
 *
 * The name is minted here rather than server-side because the blob key and the row's `filename`
 * have to be the same string.
 */
export async function uploadMediaFromClient(file: File, kind?: MediaKindT): Promise<number> {
  const filename = uniqueFileName(file.name)

  // Lazy so the ~30 KB SDK stays out of the forms that merely import this module; it is only
  // needed once a big file is actually picked.
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
