'use server'

import type { Payload, PayloadRequest } from 'payload'
import { protectedAction } from '@/lib/actions/run-action'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import { CASH_REGISTER_DELETE_TAGS, CASH_REGISTER_TRASH_TAGS } from '@/lib/cache/tags'
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

/**
 * The kasa, or `undefined` when this user may not see it. A MANAGER never sees a MAIN kasa (`/kasy`,
 * `/kasa/[id]`), so it answers as missing rather than as forbidden — the same page a MANAGER gets
 * from `/kasa/<id of MAIN>`.
 */
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
  if (register.type === 'MAIN' && !isAdminOrOwnerRole(user.role)) return undefined
  return register
}

export async function trashCashRegisterAction(registerId: number): Promise<ActionResultT> {
  return protectedAction(
    'trashCashRegisterAction',
    async ({ payload, user }) =>
      // READ COMMITTED with no row lock, so a transfer committed between the count and the write
      // still lands on a trashed kasa. Accepted: the delete re-counts and refuses, and Przywróć
      // gives the kasa back.
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
): Promise<ActionResultT> {
  return protectedAction(
    'deleteCashRegisterForeverAction',
    async ({ payload, user }) => {
      const register = await findVisibleRegister(payload, user, registerId)
      if (!register) return { success: false, error: MISSING_MESSAGE }

      const result = await deleteTrashedCashRegister(payload, registerId)
      return result.ok ? { success: true } : { success: false, error: result.message }
    },
    [...CASH_REGISTER_DELETE_TAGS],
  )
}
