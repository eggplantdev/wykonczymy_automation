import { compressImage } from '@/lib/utils/compress-image'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

// Cap parallel uploads to match the receipt-generation path (GENERATION_CONCURRENCY): batch-add lets a user
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
 * Positional invoice-mediaId array for submit. Per row index: upload the attached File; a row
 * with no File is `undefined`. `upload` is injectable for tests.
 */
export async function resolveInvoiceMediaIds(
  count: number,
  files: Map<number, File>,
  upload: (file: File) => Promise<number> = uploadFileClient,
): Promise<(number | undefined)[]> {
  return mapWithConcurrency(
    Array.from({ length: count }, (_, i) => i),
    UPLOAD_CONCURRENCY,
    async (i) => {
      const file = files.get(i)
      if (!file) return undefined
      return upload(file)
    },
  )
}
