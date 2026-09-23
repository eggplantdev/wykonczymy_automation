import { uniqueFileName } from '@/lib/utils/unique-file-name'
import { validateUploadFile } from '@/lib/utils/validate-upload-file'
import type { MediaKindT } from '@/types/media'

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
  data: { kind?: MediaKindT } = {},
): Promise<number> {
  const error = validateUploadFile(file)
  if (error) throw new Error(error)

  const filename = uniqueFileName(file.name)

  // Lazy so the ~30 KB SDK stays out of the five forms that merely import this module; it is only
  // needed once a file is actually picked.
  const { upload } = await import('@vercel/blob/client')
  await upload(filename, file, {
    access: 'public',
    contentType: file.type,
    clientPayload: 'media',
    handleUploadUrl: TOKEN_ROUTE,
  })

  return createMediaRow(filename, file, data)
}

// On Neon (`db-vercel-postgres`) concurrent Payload writes share a session: every overlapping
// `POST /api/media` answers with an id, but only one row commits — prod 2026-09-22 logged „Failed to
// persist upload data … NotFound", then the bulk insert failed its media FK. The Blob PUT carries the
// bytes and stays parallel; only the row create is chained, page-wide.
let rowCreateQueue: Promise<unknown> = Promise.resolve()

export function createMediaRow(
  filename: string,
  file: File,
  data: { kind?: MediaKindT },
): Promise<number> {
  const create = () => postMediaRow(filename, file, data)
  const queued = rowCreateQueue.then(create, create)
  rowCreateQueue = queued.catch(() => undefined)
  return queued
}

async function postMediaRow(
  filename: string,
  file: File,
  data: { kind?: MediaKindT },
): Promise<number> {
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
  // An `ok` response with an unparseable body (an edge interstitial) would otherwise surface as a
  // bare TypeError — and the caller puts `err.message` straight into a user-facing toast.
  const id = body?.doc?.id
  if (typeof id !== 'number') throw new Error('Upload nie powiódł się — serwer nie zwrócił pliku')
  return id
}
