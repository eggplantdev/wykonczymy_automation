import { receiptToLineItemValues } from '@/components/forms/expense-form/apply-receipt-to-row'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { renamePages } from '@/lib/utils/receipt-filename'
import { sameItems } from '@/lib/utils/same-items'

type DraftPrefillT = {
  lineItems: BulkExpenseFormValuesT['lineItems']
  // Keyed by row position, the shape `ExpenseFormPrefillT.files` takes.
  files: Map<number, File[]>
}

/**
 * The rows follow the worker's mode: a read that failed or hasn't landed yet still
 * opens the right rows, blank, for „Odczytaj dodane zdjęcia" to fill. `files` are the downloaded
 * pages in `draft.media` order.
 */
export function buildDraftPrefill(
  draft: Pick<ExpenseDraftRowT, 'media' | 'scanMode' | 'aiRead'>,
  files: File[],
  expenseCategory: string,
): DraftPrefillT {
  const pageIndexes = draft.media.map((_, index) => index)
  const groups =
    draft.scanMode === 'one-per-photo' && pageIndexes.length > 0
      ? pageIndexes.map((index) => [index])
      : [pageIndexes]

  const rowFiles = new Map<number, File[]>()
  const lineItems = groups.map((group, row) => {
    const mediaIds = group.map((index) => draft.media[index].id)
    // The write's compare-and-set can lose a race to a page change under READ COMMITTED, so a read
    // row fills only the row whose pages it was read from.
    const read = draft.aiRead?.rows.find((candidate) => sameItems(candidate.mediaIds, mediaIds))
    const downloaded = group.map((index) => files[index])
    const pages = read?.filename ? renamePages(downloaded, read.filename) : downloaded
    if (pages.length > 0) rowFiles.set(row, pages)
    return makeLineItem({ expenseCategory, ...(read && receiptToLineItemValues(read)) })
  })

  return { lineItems, files: rowFiles }
}
