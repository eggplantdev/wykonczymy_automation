import { APIError, type CollectionBeforeChangeHook } from 'payload'
import type { CashRegister } from '@/payload-types'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import {
  CASH_REGISTER_OWNER_LOCKED_MESSAGE,
  CASH_REGISTER_TRASHED_MESSAGE,
} from '@/lib/constants/cash-register-lock'
import { resolveId } from '@/lib/utils/resolve-id'

/**
 * A trashed kasa is read-only apart from its restore, and a used kasa keeps its owner: its balance is
 * money the owner handled, so handing the kasa over would move that history onto someone else.
 * Here rather than in the actions because `/admin` and REST update kasy too.
 */
export const guardCashRegisterUpdate: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const original = originalDoc as CashRegister | undefined
  if (operation !== 'update' || !original) return data

  const next = data as Partial<CashRegister>
  const resolved = <K extends keyof CashRegister>(field: K) =>
    field in next ? next[field] : original[field]

  if (original.trashedAt && resolved('trashedAt')) {
    throw new APIError(CASH_REGISTER_TRASHED_MESSAGE, 403)
  }

  if (resolveId(resolved('owner')) !== resolveId(original.owner)) {
    const used = await cashRegisterDeleteBlocker(req.payload, original.id, req)
    if (used) throw new APIError(CASH_REGISTER_OWNER_LOCKED_MESSAGE, 403)
  }

  return data
}
