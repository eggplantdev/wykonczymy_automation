import type { RegisterScopeT } from '@/lib/auth/roles'
import type { CashRegister } from '@/payload-types'

export function toRegisterScope(register: CashRegister): RegisterScopeT {
  const owner = typeof register.owner === 'object' ? register.owner : undefined
  return {
    type: register.type,
    ownerId: owner?.id ?? (typeof register.owner === 'number' ? register.owner : undefined),
    ownerRole: owner?.role,
  }
}
