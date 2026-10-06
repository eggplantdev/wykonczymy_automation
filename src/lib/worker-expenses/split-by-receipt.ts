import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'

// A zgłoszenie decided as several paragony lists as one row per paragon — each booked transakcja,
// and each skipped paragon as „odrzucony”. The zgłoszenie's other columns repeat on every row.
export function splitByReceipt(drafts: ExpenseDraftRowT[]): ExpenseDraftRowT[] {
  return drafts.flatMap((draft) => {
    const skipped = draft.skippedReceipts ?? []
    if (draft.transfers.length + skipped.length <= 1) return [draft]
    // A transakcja booked before paragony kept their pages shows the whole zgłoszenie's.
    const pagesOf = (mediaIds: number[] = []) =>
      mediaIds.length > 0 ? draft.media.filter((page) => mediaIds.includes(page.id)) : draft.media
    return [
      ...draft.transfers.map((transfer) => ({
        ...draft,
        transfers: [transfer],
        media: pagesOf(transfer.mediaIds),
      })),
      ...skipped.map((mediaIds) => ({
        ...draft,
        status: 'rejected' as const,
        isSkippedReceipt: true,
        transfers: [],
        media: pagesOf(mediaIds),
      })),
    ]
  })
}
