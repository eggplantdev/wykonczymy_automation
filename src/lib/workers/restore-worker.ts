import 'server-only'
import type { Payload, PayloadRequest } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { selectRegistersTrashedWithOwner } from '@/lib/db/worker-trash'

/**
 * The worker first: the kasa guard refuses a kasa restored under an owner still in the trash. Only the
 * kasy that went with him come back — one trashed on its own before him stays where it was.
 */
export async function restoreWorker(
  payload: Payload,
  workerId: number,
  req: PayloadRequest,
): Promise<void> {
  const registerIds = await selectRegistersTrashedWithOwner(await getDb(payload, req), workerId)
  await payload.update({
    collection: 'users',
    id: workerId,
    data: { trashedAt: null },
    overrideAccess: true,
    req,
  })
  for (const registerId of registerIds) {
    await payload.update({
      collection: 'cash-registers',
      id: registerId,
      data: { trashedAt: null },
      overrideAccess: true,
      req,
    })
  }
}
