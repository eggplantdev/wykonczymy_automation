import { APIError, type CollectionBeforeDeleteHook } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { accountRemovalRefusal } from '@/lib/workers/account-removal'

/** Here, not only in the trash actions, because `/admin` and REST delete users too. */
export const guardAccountRemoval: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const refusal = await accountRemovalRefusal(await getDb(req.payload, req), {
    targetId: Number(id),
    actorId: req.user ? Number(req.user.id) : undefined,
  })
  if (refusal) throw new APIError(refusal, 403)
}
