import { countRecentTransfers } from '@/lib/queries/transfers'
import { findAllCashRegistersRaw, mapCashRegisterRows } from '@/lib/queries/cash-registers'
import { findActiveInvestments, findAllInvestments } from '@/lib/queries/investments'
import { findAllUsersWithSaldos } from '@/lib/queries/users'
import { fetchReferenceData } from '@/lib/queries/reference-data'
import { getCurrentUserJwt } from '@/lib/auth/get-current-user-jwt'

export async function fetchManagerDashboardData() {
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

  const user = await getCurrentUserJwt()
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER'

  const visibleRegisters = isAdminOrOwner
    ? cashRegisters
    : cashRegisters.filter((cr) => cr.type === 'AUXILIARY')

  const totalBalance = visibleRegisters.reduce((sum, cr) => sum + cr.balance, 0)

  return {
    visibleRegisters,
    activeInvestments,
    allInvestments,
    users,
    recentCount,
    totalBalance,
    isAdminOrOwner,
  }
}
