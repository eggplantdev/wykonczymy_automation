import { upload } from '@vercel/blob/client'

import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { validateUploadFile } from '@/lib/utils/validate-upload-file'

// Registered by `vercelBlobStorage({ clientUploads })` as a Payload endpoint; it mints a
// short-lived, role-gated write token for one blob key.
const TOKEN_ROUTE = '/api/vercel-blob-client-upload-route'
const MEDIA_ROUTE = '/api/media'

/**
 * Upload a picked file to the media collection from the browser. Two hops, because the bytes must
 * not cross a Vercel function: the browser PUTs them straight to Blob, then asks Payload to create
 * the row from the key that just landed. `clientUploadContext` is what tells Payload's upload
 * pipeline the bytes are already in the store — it re-reads them through the storage adapter
 * instead of expecting them in the request body, which is what lifts the 4.5 MB cap.
 *
 * The name is minted here rather than server-side because the blob key and the row's `filename`
 * have to be the same string; `uniqueFileName` already sanitizes, so the collection's
 * `beforeChange` sanitize pass is a no-op on it rather than a rename that would orphan the key.
 */
export async function uploadMediaFromClient(
  file: File,
  data: Record<string, unknown> = {},
): Promise<number> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)

  const filename = uniqueFileName(file.name)

  await upload(filename, file, {
    access: 'public',
    contentType: file.type,
    clientPayload: 'media',
    handleUploadUrl: TOKEN_ROUTE,
  })

  const formData = new FormData()
  formData.set(
    'file',
    JSON.stringify({
      clientUploadContext: { prefix: '' },
      collectionSlug: 'media',
      filename,
      mimeType: file.type,
      size: file.size,
    }),
  )
  formData.set('_payload', JSON.stringify(data))

  const response = await fetch(MEDIA_ROUTE, { method: 'POST', body: formData })
  const body = await response.json().catch(() => undefined)

  if (!response.ok) {
    throw new Error(body?.errors?.[0]?.message ?? `Upload nie powiódł się (${response.status})`)
  }
  return body.doc.id as number
}
