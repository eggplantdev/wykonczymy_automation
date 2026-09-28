import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { relatedInvestmentLockMessage } from '@/lib/db/investment-gate'

/**
 * The other half of the transakcje gate. `validateTransfer` runs on `beforeValidate`, which Payload
 * does not fire on a delete — so without this hook an ADMIN removes a booked transaction from a
 * zakończona (or trashed) inwestycja in `/admin`, and `recalcAfterDelete` + `syncSheetAfterDelete` move both the
 * bilans and the owner's arkusz on a settled job.
 */
export const guardDeleteOnLockedInvestment: CollectionBeforeDeleteHook = async ({ req, id }) => {
  const doc = await req.payload
    .findByID({ collection: 'transactions', id, depth: 0, overrideAccess: true, req })
    .catch(() => undefined)
  const db = await getDb(req.payload, req)
  const lockMessage = await relatedInvestmentLockMessage(db, doc?.investment)
  if (lockMessage) {
    // APIError, not Error: routeError rewrites the message of anything it can't prove public,
    // so a bare throw reaches the panel as „Something went wrong" with a 500.
    throw new APIError(lockMessage, 403)
  }
}
