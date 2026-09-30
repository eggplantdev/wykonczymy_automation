import 'server-only'
import { APIError, type Payload } from 'payload'
import { logError } from '@/lib/utils/log-error'
import type { DeleteForeverResultT } from '@/types/trash'

export const NOT_TRASHED_MESSAGE = 'Najpierw przenieś inwestycję do kosza.'

/**
 * Through `payload.delete`, never raw SQL: `beforeDelete` re-counts live transactions inside the
 * delete itself, which is the last word on a row that picked one up after it was trashed.
 *
 * The DB cascade takes the kosztorys, its versions, the share link and the gallery pins with it,
 * none of which fire a Payload hook — so cache expiry is each caller's job, not this function's.
 */
export async function deleteTrashedInvestment(
  payload: Payload,
  investmentId: number,
): Promise<DeleteForeverResultT> {
  try {
    const investment = await payload.findByID({
      collection: 'investments',
      id: investmentId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!investment?.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: NOT_TRASHED_MESSAGE }
    }

    await payload.delete({
      collection: 'investments',
      id: investmentId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
    return { ok: true }
  } catch (err) {
    if (err instanceof APIError && err.status < 500) {
      return { ok: false, reason: 'blocked', message: err.message }
    }
    logError(`[deleteTrashedInvestment] ${investmentId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć inwestycji.' }
  }
}
