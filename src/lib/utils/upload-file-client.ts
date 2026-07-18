import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

// Cap parallel uploads to match the receipt-generation path (GENERATION_CONCURRENCY): batch-add lets a user
// attach 10-20+ receipts, and submitting them all at once would fire that many simultaneous upload requests.
const UPLOAD_CONCURRENCY = 4

type UploadResultT = { mediaId: number }

/** Upload a file (already processed at ingest) via the API route. Returns the media ID. */
export async function uploadFileClient(file: File): Promise<number> {
  const formData = new FormData()
  formData.set('file', file)

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

// Out-of-form invoice files are keyed by each row's stable client id (EX-448), but the submit
// contract (resolveInvoiceMediaIds / createBulkTransferAction) is positional: mediaIds[i] belongs
// to lineItems[i]. These two pure projections bridge id-space ↔ position-space at that seam and
// nowhere else, so the whole in-form apparatus stays id-keyed while the wire stays positional.

/** id-space → position-space: project the id-keyed file map onto row positions for submit. */
export function positionalFiles(
  lineItems: { id: string }[],
  byId: Map<string, File>,
): Map<number, File> {
  const positional = new Map<number, File>()
  lineItems.forEach((item, index) => {
    const file = byId.get(item.id)
    if (file) positional.set(index, file)
  })
  return positional
}

/**
 * position-space → id-space: re-key a positionally-persisted file map (a recovered optimistic
 * submission, still in wire order) onto the recovered rows' ids so the restored form is id-keyed.
 */
export function filesByRowId(
  lineItems: { id: string }[],
  positional: Map<number, File>,
): Map<string, File> {
  const byId = new Map<string, File>()
  lineItems.forEach((item, index) => {
    const file = positional.get(index)
    if (file) byId.set(item.id, file)
  })
  return byId
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
