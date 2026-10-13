import { receiptToLineItemValues } from '@/components/forms/expense-form/apply-receipt-to-row'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
  type BulkLineItemT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

type DraftPrefillT = {
  lineItems: BulkExpenseFormValuesT['lineItems']
  // Keyed by row position, the shape `ExpenseFormPrefillT.files` takes.
  files: Map<number, File[]>
  receipts: Map<string, DraftReceiptT[]>
  pagesByMediaId: Map<number, File>
}

const readOf = (part: DraftReceiptT, aiReadRows: ExpenseDraftReadRowT[]) =>
  part.readRow === undefined ? undefined : aiReadRows[part.readRow]

// The downloaded File objects themselves: the booking recognises them by identity and links their
// media ids, so a copy would upload again.
export const pagesFor = (mediaIds: number[], pagesByMediaId: Map<number, File>): File[] =>
  mediaIds.flatMap((id) => pagesByMediaId.get(id) ?? [])

export function lineItemForPart(
  part: DraftReceiptT,
  aiReadRows: ExpenseDraftReadRowT[],
  pagesByMediaId: Map<number, File>,
  expenseCategory: string,
): { lineItem: BulkLineItemT; pages: File[] } {
  const read = readOf(part, aiReadRows)
  return {
    lineItem: makeLineItem({ expenseCategory, ...(read && receiptToLineItemValues(read)) }),
    pages: pagesFor(part.mediaIds, pagesByMediaId),
  }
}

/**
 * One row per paragon the AI read, then a blank row for each photo no read row names — so a read
 * that failed or hasn't landed yet still opens a row per photo for „Odczytaj dodane zdjęcia" to
 * fill. A read from before EX-1048 may be one row over every photo; it opens as that one row.
 * `files` are the downloaded pages in `draft.media` order — empty when the download failed and the
 * dialog opens only to reject.
 */
export function buildDraftPrefill(
  draft: Pick<ExpenseDraftRowT, 'media' | 'aiRead'>,
  files: File[],
  expenseCategory: string,
): DraftPrefillT {
  const pagesByMediaId = new Map(
    draft.media.flatMap((page, index) => (files[index] ? [[page.id, files[index]] as const] : [])),
  )
  const ownIds = new Set(draft.media.map((page) => page.id))
  // `readRow` is the read's own position, which names the paragon where its pages cannot.
  const aiReadRows = draft.aiRead?.rows ?? []
  const readParts = aiReadRows.flatMap((read, readRow): DraftReceiptT[] =>
    read.mediaIds.length > 0 && read.mediaIds.every((id) => ownIds.has(id))
      ? // A copy per paragon: the server-action decoder counts a shared array once per reference,
        // and ~20 paragony on one photo tripped its nesting limit.
        [{ mediaIds: [...read.mediaIds], readRow }]
      : [],
  )
  const covered = new Set(readParts.flatMap((part) => part.mediaIds))
  const blankParts = draft.media
    .filter((page) => !covered.has(page.id))
    .map((page): DraftReceiptT => ({ mediaIds: [page.id] }))

  const rowFiles = new Map<number, File[]>()
  const receipts = new Map<string, DraftReceiptT[]>()
  const lineItems = [...readParts, ...blankParts].map((part, row) => {
    const { lineItem, pages } = lineItemForPart(part, aiReadRows, pagesByMediaId, expenseCategory)
    if (pages.length > 0) rowFiles.set(row, pages)
    receipts.set(lineItem.id, [part])
    return lineItem
  })

  return { lineItems, files: rowFiles, receipts, pagesByMediaId }
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
