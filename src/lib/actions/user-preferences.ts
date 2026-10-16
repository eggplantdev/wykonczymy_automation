'use server'

import { z } from 'zod'
import { protectedAction, validateAction } from './run-action'

const cashRegisterIdSchema = z.number().int().positive()

/**
 * this one takes the id
 * from the session, so a user can only ever move their own default.
 */
export async function setDefaultCashRegisterAction(cashRegisterId: number) {
  return protectedAction(
    'setDefaultCashRegisterAction',
    async ({ payload, user }) => {
      const parsed = validateAction(cashRegisterIdSchema, cashRegisterId)
      if (!parsed.success) return parsed

      await payload.update({
        collection: 'users',
        id: user.id,
        data: { defaultCashRegister: parsed.data },
      })

      return { success: true }
    },
    ['users'],
  )
}
