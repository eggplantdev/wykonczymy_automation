import type { InvoiceFileT } from '@/types/transfers'

/**
 * An openable file plus the small rendition a thumbnail strip shows; PDFs have no rendition.
 *
 * Cross-cutting: produced by the investment and lead queries, consumed by `MediaStrip`.
 */
export type MediaFileT = InvoiceFileT & { id: number; thumbnailUrl: string | null }
