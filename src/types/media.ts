import type { InvoiceFileT } from '@/types/transfers'

/**
 * What a media row IS, as opposed to what it looks like. It exists so a later reader — an AI asked
 * to price a remont from an investment's files — can ask for the rysunki without opening every
 * faktura. The collection's select options are typed against it, so the two cannot drift.
 */
export const MEDIA_KINDS = ['faktura', 'projekt', 'zdjecie', 'inne'] as const
export type MediaKindT = (typeof MEDIA_KINDS)[number]

/**
 * An openable file plus the small rendition a thumbnail strip shows; PDFs have no rendition.
 *
 * Cross-cutting: produced by the investment and lead queries, consumed by `MediaStrip`.
 */
export type MediaFileT = InvoiceFileT & {
  id: number
  thumbnailUrl: string | null
  kind: MediaKindT | null
}

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
