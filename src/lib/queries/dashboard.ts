import { getPayload } from 'payload'
import config from '@payload-config'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { sumAllWorkerSaldos } from '@/lib/db/sum-transfers'
import { isAdminOrOwnerRole, isManagementRole, MANAGEMENT_ROLES, RoleT } from '../auth/roles'
import { requireAuth } from '../auth/require-auth'
import type { CashRegisterTypeT } from '@/types/reference-data'
import type { CashRegisterRowT } from '@/lib/tables/cash-registers'
import type { InvestmentRowT } from '@/lib/tables/investments'
import type { UserRowT } from '@/lib/tables/users'

export async function fetchManagerDashboardData() {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')

  const isAdminOrOwner = isAdminOrOwnerRole(user.role)

  const payload = await getPayload({ config })
  const [refData, saldoMap] = await Promise.all([fetchReferenceData(), sumAllWorkerSaldos(payload)])

  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))

  const cashRegisters: CashRegisterRowT[] = refData.cashRegisters.map((cr) => ({
    id: cr.id,
    name: cr.name,
    ownerName: cr.ownerId ? (workersMap.get(cr.ownerId) ?? '—') : '—',
    balance: cr.balance,
    type: (cr.type as CashRegisterTypeT) ?? 'AUXILIARY',
    active: cr.active ?? true,
  }))

  const allInvestments: InvestmentRowT[] = refData.investments.map((inv) => ({
    id: inv.id,
    name: inv.name,
    status: inv.status,
    totalCosts: inv.totalCosts,
    totalIncome: inv.totalIncome,
    laborCosts: inv.laborCosts,
    balance: inv.totalIncome - inv.totalCosts - inv.laborCosts,
    address: inv.address,
    phone: inv.phone,
    email: inv.email,
    contactPerson: inv.contactPerson,
  }))

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
      saldo: saldoMap.get(w.id) ?? 0,
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
    .reduce((sum, cr) => sum + cr.balance, 0)

  const virtualRegisters = cashRegisters.filter((cr) => cr.type === 'VIRTUAL' && cr.active)

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
