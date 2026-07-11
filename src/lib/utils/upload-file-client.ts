import { compressImage } from '@/lib/utils/compress-image'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

// Cap parallel uploads to match the receipt-fill path (FILL_CONCURRENCY): batch-add lets a user
// attach 10-20+ receipts, and submitting them all at once would fire that many simultaneous
// client-side compressions (main-thread) + upload requests.
const UPLOAD_CONCURRENCY = 4

type UploadResultT = { mediaId: number }

/** Compress (if image) and upload a file via the API route. Returns the media ID. */
export async function uploadFileClient(file: File): Promise<number> {
  const compressed = await compressImage(file)

  const formData = new FormData()
  formData.set('file', compressed)

  const res = await fetch('/api/upload-file', {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Upload nie powiódł się' }))
    throw new Error(body.error ?? `Upload failed (${res.status})`)
  }

  const data: UploadResultT = await res.json()
  return data.mediaId
}

/**
 * Positional invoice-mediaId array for submit. Per row index: a mediaId already stored by
 * the receipt-fill upload-once path wins (no re-upload); otherwise upload the File; a row
 * with neither is `undefined`. `upload` is injectable for tests.
 */
export async function resolveInvoiceMediaIds(
  count: number,
  files: Map<number, File>,
  mediaIds: Map<number, number>,
  upload: (file: File) => Promise<number> = uploadFileClient,
): Promise<(number | undefined)[]> {
  return mapWithConcurrency(
    Array.from({ length: count }, (_, i) => i),
    UPLOAD_CONCURRENCY,
    async (i) => {
      const stored = mediaIds.get(i)
      if (stored !== undefined) return stored
      const file = files.get(i)
      if (!file) return undefined
      return upload(file)
    },
  )
}
