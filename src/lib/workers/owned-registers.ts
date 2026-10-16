import { canViewRegister, type RoleT } from '@/lib/auth/roles'
import type { CashRegisterRefT } from '@/types/reference-data'

export function ownedRegisters(cashRegisters: CashRegisterRefT[], workerId: number) {
  return cashRegisters.filter((register) => register.ownerId === workerId)
}

export function visibleWorkerRegisters(
  cashRegisters: CashRegisterRefT[],
  workerId: number,
  viewerRole: RoleT,
) {
  return ownedRegisters(cashRegisters, workerId).filter((register) =>
    canViewRegister(viewerRole, register.type),
  )
}
