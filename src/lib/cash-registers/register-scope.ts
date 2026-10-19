import type { Payload, PayloadRequest } from 'payload'
import { canManageRegister, isAdminOrOwnerRole, type RegisterScopeT } from '@/lib/auth/roles'
import type { CashRegister } from '@/payload-types'
import type { SessionUserT } from '@/types/auth'
import { resolveId } from '@/lib/utils/resolve-id'

const MISSING_MESSAGE = 'Kasa nie istnieje.'
export const FORBIDDEN_MESSAGE = 'Brak uprawnień'

export function toRegisterScope(register: CashRegister): RegisterScopeT {
  const owner = typeof register.owner === 'object' ? register.owner : undefined
  return {
    type: register.type,
    ownerId: resolveId(register.owner),
    ownerRole: owner?.role,
  }
}

export async function findManageableRegister(
  payload: Payload,
  user: SessionUserT,
  registerId: number,
  req?: PayloadRequest,
): Promise<{ register: CashRegister } | { success: false; error: string }> {
  const register = await payload.findByID({
    collection: 'cash-registers',
    id: registerId,
    depth: 1,
    overrideAccess: true,
    disableErrors: true,
    req,
  })
  if (!register) return { success: false, error: MISSING_MESSAGE }
  if (!canManageRegister(user, toRegisterScope(register))) {
    return { success: false, error: FORBIDDEN_MESSAGE }
  }
  return { register }
}

export async function canHandRegisterTo(
  payload: Payload,
  user: SessionUserT,
  register: Partial<Pick<CashRegister, 'type' | 'owner'>>,
  ownerId: number,
): Promise<boolean> {
  if (isAdminOrOwnerRole(user.role) || resolveId(register.owner) === ownerId) return true
  const owner = await payload.findByID({
    collection: 'users',
    id: ownerId,
    depth: 0,
    overrideAccess: true,
    disableErrors: true,
  })
  return !!owner && canManageRegister(user, { type: register.type, ownerId, ownerRole: owner.role })
}
