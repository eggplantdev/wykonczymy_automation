import 'server-only'
import {
  listPayoutsToConfirm,
  listRejectedPayouts,
  type PayoutToConfirmT,
  type RejectedPayoutT,
} from '@/lib/db/payout-confirmation'
import { managementDb } from '@/lib/queries/management-db'
import { workerPageDb } from '@/lib/queries/worker-page-db'

// Uncached: a wypłata booked a minute ago must be waiting for him on his next load.
export async function fetchPayoutsToConfirm(workerId: number): Promise<PayoutToConfirmT[]> {
  return listPayoutsToConfirm(await workerPageDb(workerId), workerId)
}

// Uncached: a worker's rejection must reach management on its next load.
export async function fetchRejectedPayouts(): Promise<RejectedPayoutT[]> {
  return listRejectedPayouts(await managementDb())
}
