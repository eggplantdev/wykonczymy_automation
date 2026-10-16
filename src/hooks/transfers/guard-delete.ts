import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { relatedInvestmentLockMessage } from '@/lib/db/investment-gate'

/**
 * `validateTransfer` runs on `beforeValidate`, which Payload
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
    throw new APIError(lockMessage, 403)
  }
}
