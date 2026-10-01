import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { CashRegister } from '@/payload-types'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import {
  CASH_REGISTER_OWNER_LOCKED_MESSAGE,
  CASH_REGISTER_TRASHED_MESSAGE,
} from '@/lib/constants/cash-register-lock'
import { OWNER_TRASHED_RESTORE_MESSAGE, WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'
import { getDb } from '@/lib/db/get-db'
import { trashedWorkerMessage } from '@/lib/db/worker-gate'
import { resolveId } from '@/lib/utils/resolve-id'

/**
 * A trashed kasa is read-only apart from its restore, and a used kasa keeps its owner: its balance is
 * money the owner handled, so handing the kasa over would move that history onto someone else.
 * Nor can a kasa be handed to, or restored under, an owner in the kosz (EX-918).
 * Here rather than in the actions because `/admin` and REST update kasy too.
 */
export const guardCashRegisterUpdate: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const original = originalDoc as CashRegister | undefined
  const next = data as Partial<CashRegister>
  const isOwnerTrashed = async (owner: unknown) => {
    const ownerId = resolveId(owner)
    if (ownerId === undefined) return false
    return Boolean(await trashedWorkerMessage(await getDb(req.payload, req), [ownerId]))
  }

  if (operation === 'create') {
    if (await isOwnerTrashed(next.owner)) throw new APIError(WORKER_TRASHED_MESSAGE, 403)
    return data
  }
  if (!original) return data

  const resolved = <K extends keyof CashRegister>(field: K) =>
    field in next ? next[field] : original[field]

  if (original.trashedAt && resolved('trashedAt')) {
    throw new APIError(CASH_REGISTER_TRASHED_MESSAGE, 403)
  }

  const isOwnerChange = resolveId(resolved('owner')) !== resolveId(original.owner)
  if (isOwnerChange) {
    const used = await cashRegisterDeleteBlocker(req.payload, original.id, req)
    if (used) throw new APIError(CASH_REGISTER_OWNER_LOCKED_MESSAGE, 403)
    if (await isOwnerTrashed(resolved('owner'))) throw new APIError(WORKER_TRASHED_MESSAGE, 403)
  }

  const isRestore = Boolean(original.trashedAt) && !resolved('trashedAt')
  if (isRestore && (await isOwnerTrashed(resolved('owner')))) {
    throw new APIError(OWNER_TRASHED_RESTORE_MESSAGE, 403)
  }

  return data
}
