import type { Payload } from 'payload'

import { sanitizeFileName } from '@/lib/sanitize-filename'

function validateFile(file: File): string {
  const name = file.name?.trim()
  if (!name) return 'Plik nie ma nazwy'
  if (!file.type) return 'Nierozpoznany typ pliku'
  if (file.size === 0) return 'Plik jest pusty'
  return ''
}

/** Upload a single invoice file to the media collection. Returns the media ID. */
export async function uploadInvoiceFile(payload: Payload, file: File): Promise<number> {
  console.log('[UPLOAD] file debug:', {
    name: file.name,
    type: file.type,
    size: file.size,
    nameType: typeof file.name,
  })

  const error = validateFile(file)
  if (error) throw new Error(error)

  const safeName = sanitizeFileName(file.name) || `upload-${Date.now()}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const media = await payload.create({
    collection: 'media',
    file: {
      data: buffer,
      mimetype: file.type,
      name: safeName,
      size: file.size,
    },
    data: {},
  })
  return media.id
}

/** Extract and upload a single invoice from FormData (key: 'invoice'). */
export async function uploadSingleInvoice(
  payload: Payload,
  invoiceFormData: FormData | null,
): Promise<number | undefined> {
  const file = invoiceFormData?.get('invoice') as File | null
  if (file && file.size > 0) return uploadInvoiceFile(payload, file)
  return undefined
}

/** Extract and upload invoice files from FormData for batch operations (keys: 'invoice-0', 'invoice-1', ...). */
export async function uploadBulkInvoices(
  payload: Payload,
  invoiceFormData: FormData | null,
  count: number,
): Promise<(number | undefined)[]> {
  return Promise.all(
    Array.from({ length: count }, async (_, i) => {
      const file = invoiceFormData?.get(`invoice-${i}`) as File | null
      if (file && file.size > 0) return uploadInvoiceFile(payload, file)
      return undefined
    }),
  )
}
