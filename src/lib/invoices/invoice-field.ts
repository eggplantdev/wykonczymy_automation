import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import type { MediaInfoT } from '@/lib/queries/media'
import type { InvoiceFileT } from '@/types/transfers'

// `invoice` is the transfers-side name for a generic hasMany upload field; the shape and the id
// extraction are shared with every other one (investments' `assets`, inspections' `attachments`).
export type InvoiceFieldT = UploadFieldT

/** Every page id of one doc's `invoice` field, in attachment order. */
export const invoiceIds = uploadFieldIds

/** Resolves a doc's `invoice` field into its openable pages, in attachment order. */
export function resolveInvoiceFiles(
  invoice: InvoiceFieldT,
  media: Map<number, MediaInfoT>,
): InvoiceFileT[] {
  return invoiceIds(invoice)
    .map((id) => ({ id, info: media.get(id) }))
    .filter((page): page is { id: number; info: MediaInfoT & { url: string } } =>
      Boolean(page.info?.url),
    )
    .map(({ id, info }) => ({
      id,
      url: info.url,
      filename: info.filename,
      mimeType: info.mimeType,
    }))
}

export function extractInvoiceIds(docs: { invoice?: InvoiceFieldT }[]): number[] {
  const ids = new Set<number>()
  for (const doc of docs) {
    for (const id of invoiceIds(doc.invoice)) ids.add(id)
  }
  return [...ids]
}
