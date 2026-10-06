import 'server-only'
import { scanReceiptPages, type ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import { MAX_RECEIPT_PAGES } from '@/lib/constants/receipt-scan'
import type { ExpenseDraftReadRowT, ExpenseDraftReadT } from '@/lib/db/expense-draft-read'
import type { DbExecutorT } from '@/lib/db/get-db'
import {
  loadExpenseDraftForRead,
  saveExpenseDraftRead,
  type ExpenseDraftMediaT,
} from '@/lib/db/worker-expense-drafts'
import { serverEnv } from '@/lib/env/server'
import { blobStoreIdOf, fetchMediaBytes } from '@/lib/media/blob-public-url'
import { logError } from '@/lib/utils/log-error'
import { mapWithConcurrency } from '@/lib/utils/map-with-concurrency'

const PAGE_READ_CONCURRENCY = 4

function toReadRow(mediaIds: number[], data: ReceiptFillResultT): ExpenseDraftReadRowT {
  const row: ExpenseDraftReadRowT = { mediaIds }
  if (data.description) row.description = data.description
  if (data.amount !== null) row.amount = data.amount
  if (data.netAmount !== null) row.netAmount = data.netAmount
  if (data.invoiceNote) row.invoiceNote = data.invoiceNote
  if (data.filename) row.filename = data.filename
  return row
}

// The unreadable sentinel is an answer too; only a row that never reached the model is worth
// asking again.
const hasAnswer = (row: ExpenseDraftReadRowT) => Object.keys(row).some((key) => key !== 'mediaIds')

async function readPages(storeId: string, pages: ExpenseDraftMediaT[]) {
  const bytes = await Promise.all(pages.map((page) => fetchMediaBytes(storeId, page)))
  // The category is never applied from a draft, so the model gets none to pick from.
  return scanReceiptPages(bytes, [])
}

/**
 * Runs in `after()` and from the manager's „Zobacz": a failed read is only a missing prefill, so it
 * never throws. Returns the read even when the guarded save lost to a page change — the caller
 * matches rows by `mediaIds`, so a stale row fills nothing.
 */
export async function readExpenseDraftReceipts(
  db: DbExecutorT,
  draftId: number,
): Promise<ExpenseDraftReadT | undefined> {
  try {
    const draft = await loadExpenseDraftForRead(db, draftId)
    if (!draft || draft.pages.length === 0) return
    // A draft from before the 8-photo cap can still be pending; the manager reads it by eye.
    if (draft.scanMode === 'one-invoice' && draft.pages.length > MAX_RECEIPT_PAGES) return
    const storeId = blobStoreIdOf(serverEnv.BLOB_READ_WRITE_TOKEN)
    if (!storeId) throw new Error('BLOB_READ_WRITE_TOKEN names no Blob store')

    const mediaIds = draft.pages.map((page) => page.id)
    const rows =
      draft.scanMode === 'one-invoice'
        ? [toReadRow(mediaIds, await readPages(storeId, draft.pages))]
        : await mapWithConcurrency(draft.pages, PAGE_READ_CONCURRENCY, async (page) => {
            try {
              return toReadRow([page.id], await readPages(storeId, [page]))
            } catch (error) {
              logError('readExpenseDraftReceipts page', error, { draftId, mediaId: page.id })
              return { mediaIds: [page.id] }
            }
          })

    if (!rows.some(hasAnswer)) return
    await saveExpenseDraftRead(db, { draftId, scanMode: draft.scanMode, mediaIds, read: { rows } })
    return { rows }
  } catch (error) {
    logError('readExpenseDraftReceipts', error, { draftId })
    return undefined
  }
}
