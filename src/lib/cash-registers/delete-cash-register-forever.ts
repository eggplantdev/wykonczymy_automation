import 'server-only'
import { APIError, type Payload, type PayloadRequest } from 'payload'
import type { DeleteForeverResultT } from '@/types/trash'
import { logError } from '@/lib/utils/log-error'

export const CASH_REGISTER_NOT_TRASHED_MESSAGE = 'Najpierw przenieś kasę do kosza.'

/**
 * Through `payload.delete`, never raw SQL: `beforeDelete` re-counts live transactions inside the
 * delete itself, which is the last word on a kasa that picked one up after it was trashed.
 *
 * The FK strips the kasa from its cancelled rows without firing a Payload hook, so cache expiry is
 * each caller's job.
 */
export async function deleteTrashedCashRegister(
  payload: Payload,
  registerId: number,
  req?: PayloadRequest,
): Promise<DeleteForeverResultT> {
  try {
    const register = await payload.findByID({
      collection: 'cash-registers',
      id: registerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
      req,
    })
    if (!register?.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: CASH_REGISTER_NOT_TRASHED_MESSAGE }
    }

    await payload.delete({
      collection: 'cash-registers',
      id: registerId,
      overrideAccess: true,
      context: { skipRevalidation: true },
      req,
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof APIError && err.status < 500) {
      return { ok: false, reason: 'blocked', message: err.message }
    }
    logError(`[deleteTrashedCashRegister] ${registerId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć kasy.' }
  }
}
