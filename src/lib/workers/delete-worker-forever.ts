import 'server-only'
import { APIError, type Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { selectTrashedRegisterIds } from '@/lib/db/worker-trash'
import type { DeleteForeverResultT } from '@/types/trash'
import { logError } from '@/lib/utils/log-error'

export const WORKER_NOT_TRASHED_MESSAGE = 'Najpierw przenieś pracownika do kosza.'

/**
 * His trashed kasy, then him, through `payload.delete` so each `beforeDelete` re-counts — the last
 * word on a worker or kasa that picked something up while in the trash. One transaction with no catch
 * inside: a refused kasa must take the ones before it back with it, and a statement after a failed
 * one in the same transaction only meets 25P02.
 */
export async function deleteTrashedWorker(
  payload: Payload,
  workerId: number,
): Promise<DeleteForeverResultT> {
  try {
    const worker = await payload.findByID({
      collection: 'users',
      id: workerId,
      depth: 0,
      overrideAccess: true,
      disableErrors: true,
    })
    if (!worker?.trashedAt) {
      return { ok: false, reason: 'not-trashed', message: WORKER_NOT_TRASHED_MESSAGE }
    }

    await withPayloadTransaction(
      payload,
      async (req) => {
        for (const registerId of await selectTrashedRegisterIds(
          await getDb(payload, req),
          workerId,
        )) {
          await payload.delete({
            collection: 'cash-registers',
            id: registerId,
            overrideAccess: true,
            req,
          })
        }
        await payload.delete({ collection: 'users', id: workerId, overrideAccess: true, req })
      },
      { skipRevalidation: true },
    )
    return { ok: true }
  } catch (err) {
    if (err instanceof APIError && err.status < 500) {
      return { ok: false, reason: 'blocked', message: err.message }
    }
    logError(`[deleteTrashedWorker] ${workerId}`, err)
    return { ok: false, reason: 'error', message: 'Nie udało się usunąć pracownika.' }
  }
}
