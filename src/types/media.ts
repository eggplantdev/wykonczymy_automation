import type { InvoiceFileT } from '@/types/transfers'

/**
 * An openable file plus the small rendition a thumbnail strip shows; PDFs have no rendition.
 *
 * Cross-cutting: produced by the investment and lead queries, consumed by `MediaStrip`.
 */
export type MediaFileT = InvoiceFileT & { id: number; thumbnailUrl: string | null }

/**
 * What a preview surface calls the files it is showing. Every field is required so a new caller
 * has to name its own wording — a default set would quietly re-introduce „faktura" for site photos.
 */
export type PreviewLabelsT = {
  fallbackTitle: string
  empty: string
  archivePrefix: string
  removeOne: string
  removeOneOfMany: string
  preview: string
  removeAll: string
  add: string
}
