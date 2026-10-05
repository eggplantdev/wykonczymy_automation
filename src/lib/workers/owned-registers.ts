import { canViewRegister, type RoleT } from '@/lib/auth/roles'
import type { CashRegisterRefT } from '@/types/reference-data'

// Over the live kasy this is exactly the set „Do kosza” takes along with the worker.
export function ownedRegisters(cashRegisters: CashRegisterRefT[], workerId: number) {
  return cashRegisters.filter((register) => register.ownerId === workerId)
}

/**
 * The worker page's one kasa set: „Moje kasy", the transfer scope and the kasa filter all
 * read it, so a kasa the viewer may not see can't leak back in through any of the three.
 */
export function visibleWorkerRegisters(
  cashRegisters: CashRegisterRefT[],
  workerId: number,
  viewerRole: RoleT,
) {
  return ownedRegisters(cashRegisters, workerId).filter((register) =>
    canViewRegister(viewerRole, register.type),
  )
}
