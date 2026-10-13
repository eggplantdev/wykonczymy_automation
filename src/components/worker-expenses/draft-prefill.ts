import { receiptToLineItemValues } from '@/components/forms/expense-form/apply-receipt-to-row'
import {
  makeLineItem,
  type BulkExpenseFormValuesT,
  type BulkLineItemT,
} from '@/components/forms/expense-form/bulk-expense-form'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { renamePages } from '@/lib/utils/receipt-filename'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

type DraftPrefillT = {
  lineItems: BulkExpenseFormValuesT['lineItems']
  // Keyed by row position, the shape `ExpenseFormPrefillT.files` takes.
  files: Map<number, File[]>
  // Keyed by line item id: the paragony each row stands for — one until the manager merges rows.
  receipts: Map<string, DraftReceiptT[]>
  // The downloaded page of each photo, which a split row takes its files from again.
  pagesByMediaId: Map<number, File>
}

type PartWithReadT = { part: DraftReceiptT; read?: ExpenseDraftReadRowT }

/** One paragon as a form row, filled from its read row when there is one, with its own pages. */
export function lineItemForPart(
  part: DraftReceiptT,
  read: ExpenseDraftReadRowT | undefined,
  pagesByMediaId: Map<number, File>,
  expenseCategory: string,
): { lineItem: BulkLineItemT; pages: File[] } {
  const downloaded = part.mediaIds.flatMap((id) => pagesByMediaId.get(id) ?? [])
  return {
    lineItem: makeLineItem({ expenseCategory, ...(read && receiptToLineItemValues(read)) }),
    pages: read?.filename ? renamePages(downloaded, read.filename) : downloaded,
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
  const readParts = (draft.aiRead?.rows ?? []).flatMap((read, readRow): PartWithReadT[] =>
    read.mediaIds.length > 0 && read.mediaIds.every((id) => ownIds.has(id))
      ? // A copy per paragon: the server-action decoder counts a shared array once per reference,
        // and ~20 paragony on one photo tripped its nesting limit.
        [{ part: { mediaIds: [...read.mediaIds], readRow }, read }]
      : [],
  )
  const covered = new Set(readParts.flatMap(({ part }) => part.mediaIds))
  const blankParts = draft.media
    .filter((page) => !covered.has(page.id))
    .map((page): PartWithReadT => ({ part: { mediaIds: [page.id] } }))

  const rowFiles = new Map<number, File[]>()
  const receipts = new Map<string, DraftReceiptT[]>()
  const lineItems = [...readParts, ...blankParts].map(({ part, read }, row) => {
    const { lineItem, pages } = lineItemForPart(part, read, pagesByMediaId, expenseCategory)
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
