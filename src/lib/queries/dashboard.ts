import {
  fetchReferenceData,
  fetchWorkerSaldos,
  fetchRegisterBalances,
  fetchInvestmentFinancials,
} from '@/lib/queries/reference-data'
import { isAdminOrOwnerRole, isManagementRole, MANAGEMENT_ROLES, RoleT } from '../auth/roles'
import { requireAuth } from '../auth/require-auth'
import { perfStart } from '@/lib/perf'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

export async function fetchManagerDashboardData() {
  const elapsed = perfStart()
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')

  const isAdminOrOwner = isAdminOrOwnerRole(user.role)

  const [refData, saldoRecord, balanceRecord, financialsRecord] = await Promise.all([
    fetchReferenceData(),
    fetchWorkerSaldos(),
    fetchRegisterBalances(),
    fetchInvestmentFinancials(),
  ])

  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))

  const cashRegisters: CashRegisterRowT[] = refData.cashRegisters.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: cr.ownerId ? (workersMap.get(cr.ownerId) ?? '—') : '—',
    balance: balanceRecord[String(cr.id)] ?? 0,
    type: (cr.type as CashRegisterTypeT) ?? 'AUXILIARY',
    active: cr.active ?? true,
  }))

  const allInvestments: InvestmentRowT[] = refData.investments.map((inv) => {
    const fin = financialsRecord[String(inv.id)]
    const totalCosts = fin?.totalCosts ?? 0
    const totalIncome = fin?.totalIncome ?? 0
    const totalLaborCosts = fin?.totalLaborCosts ?? 0
    return {
      id: inv.id,
      name: inv.name,
      status: inv.status,
      totalCosts,
      totalIncome,
      totalLaborCosts,
      balance: totalIncome - totalCosts - totalLaborCosts,
      address: inv.address,
      phone: inv.phone,
      email: inv.email,
      contactPerson: inv.contactPerson,
    }
  })

  const activeInvestments = refData.investments
    .filter((i) => i.active)
    .map((i) => ({ id: i.id, name: i.name }))

  const users: UserRowT[] = refData.workers
    .filter((w) => w.type === 'EMPLOYEE')
    .map((w) => ({
      id: w.id,
      name: w.name,
      email: w.email,
      role: w.type as RoleT,
      saldo: saldoRecord[String(w.id)] ?? 0,
      active: w.active ?? true,
    }))

  const managementUsers = refData.workers
    .filter((w) => isManagementRole(w.type as RoleT))
    .map((w) => ({ id: w.id, name: w.name }))

  // admin can see all, manager can see auxiliary and virtual registers
  const visibleRegisters = isAdminOrOwner
    ? cashRegisters
    : cashRegisters.filter((cr) => cr.type !== 'MAIN')

  const totalBalance = visibleRegisters
    .filter((cr) => cr.type !== 'VIRTUAL')
    .reduce((sum, cr) => sum + cr.balance, 0)

  const ownedBalance = refData.cashRegisters
    .filter((cr) => cr.ownerId === user!.id && cr.type !== 'VIRTUAL')
    .reduce((sum, cr) => sum + (balanceRecord[String(cr.id)] ?? 0), 0)

  const virtualRegisters = cashRegisters.filter((cr) => cr.type === 'VIRTUAL' && cr.active)

  console.log(`[PERF] query.fetchManagerDashboardData ${elapsed()}ms`)

  return {
    visibleRegisters,
    activeInvestments,
    allInvestments,
    users,
    managementUsers,
    totalBalance,
    ownedBalance,
    virtualRegisters,
    isAdminOrOwner,
    currentUserId: user!.id,
  }
}
