import 'server-only'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import { scanReceiptPages, type ReceiptFillResultT } from '@/lib/ai/scan-receipt'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
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

// An unreadable receipt prefills a blank row (owner, 2026-10-06): the manager reads it by eye.
function toReadRow(mediaIds: number[], data: ReceiptFillResultT): ExpenseDraftReadRowT {
  const row: ExpenseDraftReadRowT = { mediaIds }
  if (data.description === UNREADABLE_RECEIPT) return row
  if (data.description) row.description = data.description
  if (data.amount !== null) row.amount = data.amount
  if (data.netAmount !== null) row.netAmount = data.netAmount
  if (data.invoiceNote) row.invoiceNote = data.invoiceNote
  if (data.filename) row.filename = data.filename
  return row
}

const hasReading = (row: ExpenseDraftReadRowT) => Object.keys(row).some((key) => key !== 'mediaIds')

async function readPages(storeId: string, pages: ExpenseDraftMediaT[]) {
  const bytes = await Promise.all(pages.map((page) => fetchMediaBytes(storeId, page)))
  // The category is never applied from a draft, so the model gets none to pick from.
  return scanReceiptPages(bytes, [])
}

/** Runs in `after()`: a failed read is only a missing prefill, so it never throws. */
export async function readExpenseDraftReceipts(db: DbExecutorT, draftId: number): Promise<void> {
  try {
    const draft = await loadExpenseDraftForRead(db, draftId)
    if (!draft || draft.pages.length === 0) return
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

    if (!rows.some(hasReading)) return
    await saveExpenseDraftRead(db, { draftId, scanMode: draft.scanMode, mediaIds, read: { rows } })
  } catch (error) {
    logError('readExpenseDraftReceipts', error, { draftId })
  }
}
