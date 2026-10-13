import { receiptToLineItemValues } from '@/components/forms/expense-form/apply-receipt-to-row'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
  type BulkLineItemT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { renamePages } from '@/lib/utils/receipt-filename'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'
import { sameItems } from '@/lib/utils/same-items'

type DraftPrefillT = {
  lineItems: BulkExpenseFormValuesT['lineItems']
  // Keyed by row position, the shape `ExpenseFormPrefillT.files` takes.
  files: Map<number, File[]>
  // Keyed by line item id: the paragon each row stands for.
  receipts: Map<string, DraftReceiptT>
}

/**
 * The rows follow the worker's mode: a read that failed or hasn't landed yet still
 * opens the right rows, blank, for „Odczytaj dodane zdjęcia" to fill. A photo the AI found several
 * paragony on opens one row per paragon. `files` are the downloaded pages in `draft.media` order —
 * empty when the download failed and the dialog opens only to reject.
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

  const rows = groups.flatMap((group) => {
    const mediaIds = group.map((index) => draft.media[index].id)
    // `readRow` is the read's own position, which names the paragon where its pages cannot.
    const reads = (draft.aiRead?.rows ?? []).flatMap((read, readRow) =>
      sameItems(read.mediaIds, mediaIds) ? [{ read, readRow }] : [],
    )
    const downloaded = group.flatMap((index) => files[index] ?? [])
    return (reads.length > 0 ? reads : [undefined]).map((found) => ({
      // A copy per paragon: the server-action decoder counts a shared array once per reference, and
      // ~20 paragony on one photo tripped its nesting limit.
      mediaIds: [...mediaIds],
      found,
      pages: found?.read.filename ? renamePages(downloaded, found.read.filename) : downloaded,
    }))
  })

  const rowFiles = new Map<number, File[]>()
  const receipts = new Map<string, DraftReceiptT>()
  const lineItems = rows.map(({ mediaIds, found, pages }, row) => {
    if (pages.length > 0) rowFiles.set(row, pages)
    const lineItem = makeLineItem({
      expenseCategory,
      ...(found && receiptToLineItemValues(found.read)),
    })
    receipts.set(lineItem.id, found ? { mediaIds, readRow: found.readRow } : { mediaIds })
    return lineItem
  })

  return { lineItems, files: rowFiles, receipts }
}

/**
 * The category stays a manual pick: nothing on a draft without an investment says what kind of cost
 * it was.
 */
export function withDraftTarget(
  draft: Pick<ExpenseDraftRowT, 'investmentId' | 'workerId'>,
  lineItems: BulkLineItemT[],
): Pick<BulkExpenseFormValuesT, 'type' | 'investment' | 'lineItems'> {
  if (draft.investmentId !== null) {
    return { type: 'INVESTMENT_EXPENSE', investment: String(draft.investmentId), lineItems }
  }
  const worker = String(draft.workerId)
  return {
    type: 'OTHER',
    investment: '',
    lineItems: lineItems.map((lineItem) => ({ ...lineItem, worker })),
  }
}
