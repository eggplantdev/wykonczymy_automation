import 'server-only'
import { UNREADABLE_RECEIPT } from '@/lib/ai/receipt-extraction-schema'
import { scanReceiptList, scanReceiptPages, type ReceiptFillResultT } from '@/lib/ai/scan-receipt'
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
  if (data.documentNumber) row.documentNumber = data.documentNumber
  if (data.sellerNip) row.sellerNip = data.sellerNip
  if (data.documentDate) row.documentDate = data.documentDate
  if (data.filename) row.filename = data.filename
  return row
}

// The unreadable sentinel is an answer too; only a row that never reached the model is worth
// asking again.
const hasAnswer = (row: ExpenseDraftReadRowT) => Object.keys(row).some((key) => key !== 'mediaIds')

// The category is never applied from a draft, so the model gets none to pick from.
async function readInvoice(storeId: string, pages: ExpenseDraftMediaT[]) {
  const bytes = await Promise.all(pages.map((page) => fetchMediaBytes(storeId, page)))
  return scanReceiptPages(bytes, [])
}

// One photo can hold several paragony, each its own row on that photo.
async function readPhoto(
  storeId: string,
  page: ExpenseDraftMediaT,
): Promise<ExpenseDraftReadRowT[]> {
  const receipts = await scanReceiptList([await fetchMediaBytes(storeId, page)], [])
  if (receipts.length === 0) return [{ mediaIds: [page.id], description: UNREADABLE_RECEIPT }]
  return receipts.map((receipt) => toReadRow([page.id], receipt))
}

/**
 * Runs in `after()` and from the manager's „Zobacz": a failed read is only a missing prefill, so it
 * never throws. Returns the read the draft holds, which is an overlapping read's when that one
 * was stored first. `blobStoreId` lets a script read production's pages from a machine whose token
 * names the preview store.
 */
export async function readExpenseDraftReceipts(
  db: DbExecutorT,
  draftId: number,
  blobStoreId?: string,
): Promise<ExpenseDraftReadT | undefined> {
  try {
    const draft = await loadExpenseDraftForRead(db, draftId)
    if (!draft || draft.pages.length === 0) return
    // A sent draft's pages and mode never change, so a stored read still answers them.
    if (draft.aiRead) return draft.aiRead
    // One photo is read paragon by paragon whatever the mode says: every single-photo draft sent
    // before 2026-10-12 says „Jeden wydatek”.
    const isInvoice = draft.scanMode === 'one-invoice' && draft.pages.length > 1
    // A draft from before the 8-photo cap can still be pending; the manager reads it by eye.
    if (isInvoice && draft.pages.length > MAX_RECEIPT_PAGES) return
    const storeId = blobStoreId ?? blobStoreIdOf(serverEnv.BLOB_READ_WRITE_TOKEN)
    if (!storeId) throw new Error('BLOB_READ_WRITE_TOKEN names no Blob store')

    const mediaIds = draft.pages.map((page) => page.id)
    const rows = isInvoice
      ? [toReadRow(mediaIds, await readInvoice(storeId, draft.pages))]
      : (
          await mapWithConcurrency(draft.pages, PAGE_READ_CONCURRENCY, async (page) => {
            try {
              return await readPhoto(storeId, page)
            } catch (error) {
              logError('readExpenseDraftReceipts page', error, { draftId, mediaId: page.id })
              return [{ mediaIds: [page.id] }]
            }
          })
        ).flat()

    if (!rows.some(hasAnswer)) return
    return await saveExpenseDraftRead(db, draftId, { rows })
  } catch (error) {
    logError('readExpenseDraftReceipts', error, { draftId })
    return undefined
  }
}
