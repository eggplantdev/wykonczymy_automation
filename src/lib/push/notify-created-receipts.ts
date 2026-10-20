import 'server-only'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { pendingReceiptsOf } from '@/lib/db/receipt-confirmation'
import { notifyPendingReceipts } from '@/lib/push/notify-pending-receipts'
import { logError } from '@/lib/utils/log-error'

// The stamp decides who is asked, so the push reads it back.
export async function notifyCreatedReceipts(
  payload: Payload,
  transactionIds: number[],
): Promise<void> {
  try {
    const db = await getDb(payload)
    await notifyPendingReceipts(db, await pendingReceiptsOf(db, transactionIds))
  } catch (err) {
    // TODO(EX-958) SENTRY-REQUIRED: a booking whose push never went out is invisible to the worker.
    logError('[PUSH] receipt read-back failed', err, { transactionIds })
  }
}
