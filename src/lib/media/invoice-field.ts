import { uploadFieldIds, type UploadFieldT } from '@/lib/media/upload-field'
import type { MediaInfoT } from '@/lib/queries/media'
import type { PreviewFileT } from '@/types/media'

/** Resolves a doc's `invoice` field into its openable pages, in attachment order. */
export function resolveInvoiceFiles(
  invoice: UploadFieldT,
  media: Map<number, MediaInfoT>,
): PreviewFileT[] {
  return uploadFieldIds(invoice)
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

export function extractInvoiceIds(docs: { invoice?: UploadFieldT }[]): number[] {
  const ids = new Set<number>()
  for (const doc of docs) {
    for (const id of uploadFieldIds(doc.invoice)) ids.add(id)
  }
  return [...ids]
}
