import { postFormData } from '@/lib/utils/post-form-data'
import type { ReceiptFillResultT } from '@/lib/ai/scan-receipt'

// The upload path stopped crossing a Vercel function (bytes go browser→Blob), but this one still
// does: `/api/extract-receipt` is a Route Handler, so the platform's 4.5 MB request-body cap kills
// an oversize POST before the handler runs — an uncatchable 413. Guarding the summed pages here
// turns that into a readable refusal; the margin covers the multipart boundaries and the other
// form field. This is the ONLY remaining consumer of ingest output that has a body limit.
const MAX_SCAN_BYTES = 4 * 1024 * 1024

export async function scanReceiptClient(
  files: File[],
  otherCategoryNames: string[],
): Promise<ReceiptFillResultT> {
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)
  if (totalBytes > MAX_SCAN_BYTES) {
    throw new Error('Plik jest za duży do odczytu AI — wypełnij pozycję ręcznie')
  }

  const formData = new FormData()
  for (const file of files) formData.append('files', file)
  formData.set('otherCategoryNames', JSON.stringify(otherCategoryNames))

  const body = await postFormData<{ data: ReceiptFillResultT }>(
    '/api/extract-receipt',
    formData,
    'Błąd odczytu paragonu',
  )
  return body.data
}
