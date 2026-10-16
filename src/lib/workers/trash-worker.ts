import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { trashCashRegister } from '@/lib/cash-registers/trash-cash-register'
import { getDb } from '@/lib/db/get-db'
import { deleteUserSessions } from '@/lib/db/user-sessions'
import { deletePushSubscriptions } from '@/lib/db/push-subscriptions'
import { selectLiveRegisterIds } from '@/lib/db/worker-trash'
import { workerUseBlocker } from '@/lib/workers/delete-blocker'

// `withPayloadTransaction` commits a returned refusal, so every refusal is decided before the first
// write.
export async function trashWorker(
  payload: Payload,
  workerId: number,
  req: PayloadRequest,
): Promise<string | undefined> {
  const used = await workerUseBlocker(payload, workerId, req)
  if (used) return used

  const db = await getDb(payload, req)
  const registerIds = await selectLiveRegisterIds(db, workerId)
  for (const registerId of registerIds) {
    const refusal = await cashRegisterDeleteBlocker(payload, registerId, req)
    if (refusal) return refusal
  }

  const trashedAt = new Date().toISOString()
  for (const registerId of registerIds) {
    const refusal = await trashCashRegister(payload, registerId, req, trashedAt)
    // Throw, never return: the kasy before it are already written and must roll back with it.
    if (refusal) throw new Error(refusal)
  }
  await payload.update({
    collection: 'users',
    id: workerId,
    data: { trashedAt },
    overrideAccess: true,
    req,
  })
  await deleteUserSessions(db, workerId)
  await deletePushSubscriptions(db, workerId)
  return undefined
}
