import {
  fetchReferenceData,
  fetchRegisterBalances,
  type RegisterBalanceMapT,
} from '@/lib/queries/reference-data'
import { isAdminOrOwnerRole, MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { requireAuth } from '@/lib/auth/require-auth'
import type { CashRegisterRefT, WorkerRefT, CashRegisterTypeT } from '@/types/reference-data'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'

export function shapeCashRegisters(
  cashRegisters: CashRegisterRefT[],
  workers: WorkerRefT[],
  balances: RegisterBalanceMapT,
): CashRegisterRowT[] {
  const workersMap = new Map(workers.map((w) => [w.id, w.name]))
  return cashRegisters.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: cr.ownerId ? (workersMap.get(cr.ownerId) ?? '—') : '—',
    balance: balances[String(cr.id)] ?? 0,
    type: (cr.type as CashRegisterTypeT) ?? 'AUXILIARY',
    active: cr.active ?? true,
  }))
}

export async function fetchVisibleRegisters(): Promise<{
  registers: CashRegisterRowT[]
  isAdminOrOwner: boolean
}> {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')
  const isAdminOrOwner = isAdminOrOwnerRole(user.role)

  const [refData, balances] = await Promise.all([fetchReferenceData(), fetchRegisterBalances()])
  const registers = shapeCashRegisters(refData.cashRegisters, refData.workers, balances)
  // admin/owner see all; manager hides MAIN registers (matches prior dashboard behavior)
  const visible = isAdminOrOwner ? registers : registers.filter((cr) => cr.type !== 'MAIN')
  return { registers: visible, isAdminOrOwner }
}
