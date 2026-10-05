import type { CashRegisterRefT } from '@/types/reference-data'

// Over the live kasy this is exactly the set „Do kosza” takes along with the worker.
export function ownedRegisters(cashRegisters: CashRegisterRefT[], workerId: number) {
  return cashRegisters.filter((register) => register.ownerId === workerId)
}
