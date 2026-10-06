import { receiptToLineItemValues } from '@/components/forms/expense-form/apply-receipt-to-row'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { pageFilename } from '@/lib/utils/receipt-filename'

type DraftPrefillT = {
  lineItems: BulkExpenseFormValuesT['lineItems']
  // Keyed by row position, the shape `ExpenseFormPrefillT.files` takes.
  files: Map<number, File[]>
}

const sameIds = (a: number[], b: number[]) =>
  a.length === b.length && a.every((id, i) => id === b[i])

/**
 * The rows follow the worker's mode, not the read: a read that failed or hasn't landed yet still
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
    const read = draft.aiRead?.rows.find((candidate) => sameIds(candidate.mediaIds, mediaIds))
    const pages = group.map((index, page) =>
      read?.filename
        ? new File([files[index]], pageFilename(read.filename, page), { type: files[index].type })
        : files[index],
    )
    if (pages.length > 0) rowFiles.set(row, pages)
    return makeLineItem({ expenseCategory, ...(read && receiptToLineItemValues(read)) })
  })

  return { lineItems, files: rowFiles }
}
