'use server'

import { protectedAction } from '@/lib/actions/run-action'
import { CASH_REGISTER_DELETE_TAGS, CASH_REGISTER_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { deleteTrashedCashRegister } from '@/lib/cash-registers/delete-cash-register-forever'
import { trashCashRegister } from '@/lib/cash-registers/trash-cash-register'
import { findManageableRegister } from '@/lib/cash-registers/register-scope'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import type { ActionResultT } from '@/types/action'

// The caller expires the tags itself, through the wrapper — the hooks' own revalidation would
// fire once per write and inside the transaction.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

export async function trashCashRegisterAction(registerId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashCashRegisterAction',
    async ({ payload, user }) =>
      withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const found = await findManageableRegister(payload, user, registerId, req)
          if (!('register' in found)) return found
          if (found.register.trashedAt) return { success: true }

          const refusal = await trashCashRegister(payload, registerId, req)
          return refusal ? { success: false, error: refusal } : { success: true }
        },
        SKIP_HOOK_REVALIDATION,
      ),
    [...CASH_REGISTER_TRASH_TAGS],
  )
}

export async function restoreCashRegisterAction(registerId: number): Promise<ActionResultT> {
  return protectedAction(
    'restoreCashRegisterAction',
    async ({ payload, user }) => {
      const found = await findManageableRegister(payload, user, registerId)
      if (!('register' in found)) return found

      await payload.update({
        collection: 'cash-registers',
        id: registerId,
        data: { trashedAt: null },
        overrideAccess: true,
        context: SKIP_HOOK_REVALIDATION,
      })
      return { success: true }
    },
    [...CASH_REGISTER_TRASH_TAGS],
  )
}

export async function deleteCashRegisterForeverAction(
  registerId: number,
  confirmName: string,
): Promise<ActionResultT> {
  return protectedAction(
    'deleteCashRegisterForeverAction',
    async ({ payload, user }) => {
      const found = await findManageableRegister(payload, user, registerId)
      if (!('register' in found)) return found
      if (!isNameConfirmed(confirmName, found.register.name)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await deleteTrashedCashRegister(payload, registerId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...CASH_REGISTER_DELETE_TAGS],
  )
}
