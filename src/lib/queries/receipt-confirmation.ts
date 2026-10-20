import 'server-only'
import {
  listReceiptsToConfirm,
  listRejectedReceipts,
  type ReceiptToConfirmT,
  type RejectedReceiptConfirmationT,
} from '@/lib/db/receipt-confirmation'
import { managementDb } from '@/lib/queries/management-db'
import { workerPageDb } from '@/lib/queries/worker-page-db'

// Uncached: a receipt booked a minute ago must be waiting for him on his next load.
export async function fetchReceiptsToConfirm(workerId: number): Promise<ReceiptToConfirmT[]> {
  return listReceiptsToConfirm(await workerPageDb(workerId), workerId)
}

// Uncached: a worker's rejection must reach management on its next load.
export async function fetchRejectedReceipts(): Promise<RejectedReceiptConfirmationT[]> {
  return listRejectedReceipts(await managementDb())
}
