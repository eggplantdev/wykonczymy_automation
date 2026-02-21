import { countRecentTransfers } from '@/lib/queries/transfers'
import { findAllCashRegistersRaw, mapCashRegisterRows } from '@/lib/queries/cash-registers'
import { findActiveInvestments, findAllInvestments } from '@/lib/queries/investments'
import { findAllUsersWithSaldos } from '@/lib/queries/users'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { isAdminOrOwnerRole, isManagementRole, MANAGEMENT_ROLES, RoleT } from '../auth/roles'
import { requireAuth } from '../auth/require-auth'

export async function fetchManagerDashboardData() {
  const { user } = await requireAuth(MANAGEMENT_ROLES)
  if (!user) throw new Error('Nie jesteś zalogowany')

  const isAdminOrOwner = isAdminOrOwnerRole(user.role)

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const sinceDate = thirtyDaysAgo.toISOString().split('T')[0]

  const [rawCashRegisters, activeInvestments, allInvestments, users, recentCount, refData] =
    await Promise.all([
      findAllCashRegistersRaw(),
      findActiveInvestments(),
      findAllInvestments(),
      findAllUsersWithSaldos(),
      countRecentTransfers(sinceDate),
      fetchReferenceData(),
    ])

  const workersMap = new Map(refData.workers.map((w) => [w.id, w.name]))
  const cashRegisters = mapCashRegisterRows(rawCashRegisters, workersMap)

  // admin can see all, manager can see auxiliary and virtual registers
  const visibleRegisters = isAdminOrOwner
    ? cashRegisters
    : cashRegisters.filter((cr) => cr.type !== 'MAIN')

  const totalBalance = visibleRegisters
    .filter((cr) => cr.type !== 'VIRTUAL')
    .reduce((sum, cr) => sum + cr.balance, 0)

  const managementUsers = refData.workers
    .filter((w) => isManagementRole(w.type as RoleT))
    .map((w) => ({ id: w.id, name: w.name }))

  return {
    visibleRegisters,
    activeInvestments,
    allInvestments,
    users,
    managementUsers,
    recentCount,
    totalBalance,
    isAdminOrOwner,
    currentUserId: user!.id,
  }
}
