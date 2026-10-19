'use server'

import {
  cashRegisterSchema,
  type CashRegisterFormDataT,
} from '@/components/forms/cash-register-form/cash-register-schema'
import { isAdminOrOwnerRole } from '@/lib/auth/roles'
import type { SessionUserT } from '@/types/auth'
import {
  FORBIDDEN_MESSAGE,
  canHandRegisterTo,
  findManageableRegister,
} from '@/lib/cash-registers/register-scope'
import { validateAction, protectedAction } from './run-action'

/**
 * A MANAGER may open registers, but only AUXILIARY ones and never touching `active` — the rules the
 * collection states as `enforceAuxiliaryForManager` + the field-level access on `active`. Restated
 * here because the Local API runs with `overrideAccess` and no `req.user`, so neither of those fires
 * on this path: without this the hidden fields would be a client-side suggestion, not a limit.
 *
 * On UPDATE the type is dropped rather than forced: forcing it would silently demote a VIRTUAL or
 * WORKER register to AUXILIARY the moment a manager renamed it.
 */
function withinManagerScope(
  user: SessionUserT,
  data: CashRegisterFormDataT,
  operation: 'create' | 'update',
) {
  if (isAdminOrOwnerRole(user.role)) return data
  const { active: _active, type: _type, ...rest } = data
  return operation === 'create' ? { ...rest, type: 'AUXILIARY' as const } : rest
}

export async function createCashRegisterAction(data: CashRegisterFormDataT) {
  return protectedAction(
    'createCashRegisterAction',
    async ({ payload, user }) => {
      const parsed = validateAction(cashRegisterSchema, data)
      if (!parsed.success) return parsed

      if (!(await canHandRegisterTo(payload, user, {}, parsed.data.owner))) {
        return { success: false, error: FORBIDDEN_MESSAGE }
      }

      await payload.create({
        collection: 'cash-registers',
        data: withinManagerScope(user, parsed.data, 'create'),
      })

      return { success: true }
    },
    ['cashRegisters'],
  )
}

export async function updateCashRegisterAction(id: number, data: CashRegisterFormDataT) {
  return protectedAction(
    'updateCashRegisterAction',
    async ({ payload, user }) => {
      const parsed = validateAction(cashRegisterSchema, data)
      if (!parsed.success) return parsed

      const found = await findManageableRegister(payload, user, id)
      if (!('register' in found)) return found
      if (!(await canHandRegisterTo(payload, user, found.register, parsed.data.owner))) {
        return { success: false, error: FORBIDDEN_MESSAGE }
      }

      await payload.update({
        collection: 'cash-registers',
        id,
        data: withinManagerScope(user, parsed.data, 'update'),
      })

      return { success: true }
    },
    ['cashRegisters'],
  )
}
