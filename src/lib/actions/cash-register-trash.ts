'use server'

import type { Payload, PayloadRequest } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { canViewRegister } from '@/lib/auth/roles'
import { CASH_REGISTER_DELETE_TAGS, CASH_REGISTER_TRASH_TAGS } from '@/lib/cache/tags'
import { isNameConfirmed, NAME_MISMATCH_MESSAGE } from '@/lib/constants/trash'
import { deleteTrashedCashRegister } from '@/lib/cash-registers/delete-cash-register-forever'
import { trashCashRegister } from '@/lib/cash-registers/trash-cash-register'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import type { CashRegister } from '@/payload-types'
import type { ActionResultT } from '@/types/action'
import type { SessionUserT } from '@/types/auth'

const MISSING_MESSAGE = 'Kasa nie istnieje.'

// The caller expires the tags itself, through the wrapper — the hooks' own revalidation would
// fire once per write and inside the transaction.
const SKIP_HOOK_REVALIDATION = { skipRevalidation: true }

async function findVisibleRegister(
  payload: Payload,
  user: SessionUserT,
  registerId: number,
  req?: PayloadRequest,
): Promise<CashRegister | undefined> {
  const register = await payload.findByID({
    collection: 'cash-registers',
    id: registerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!register) return undefined
  if (!canViewRegister(user.role, register.type)) return undefined
  return register
}

export async function trashCashRegisterAction(registerId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashCashRegisterAction',
    async ({ payload, user }) =>
      withPayloadTransaction(
        payload,
        async (req): Promise<ActionResultT> => {
          const register = await findVisibleRegister(payload, user, registerId, req)
          if (!register) return { success: false, error: MISSING_MESSAGE }
          if (register.trashedAt) return { success: true }

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
      const register = await findVisibleRegister(payload, user, registerId)
      if (!register) return { success: false, error: MISSING_MESSAGE }

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
      const register = await findVisibleRegister(payload, user, registerId)
      if (!register) return { success: false, error: MISSING_MESSAGE }
      if (!isNameConfirmed(confirmName, register.name)) {
        return { success: false, error: NAME_MISMATCH_MESSAGE }
      }

      const result = await deleteTrashedCashRegister(payload, registerId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...CASH_REGISTER_DELETE_TAGS],
  )
}
