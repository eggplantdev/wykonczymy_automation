import { fetchReferenceData } from '@/lib/queries/reference-data'
import { isManagementRole } from '@/lib/auth/roles'
import { fetchVisibleRegisters } from '@/lib/queries/cash-registers'
import { perfStart } from '@/lib/perf'

export async function fetchManagerDashboardData() {
  const elapsed = perfStart()

  const [{ registers: visibleRegisters, isAdminOrOwner }, refData] = await Promise.all([
    fetchVisibleRegisters(),
    fetchReferenceData(),
  ])

  const activeInvestments = refData.investments
    .filter((i) => i.active)
    .map((i) => ({ id: i.id, name: i.name }))

  const managementUsers = refData.workers
    .filter((w) => isManagementRole(w.role))
    .map((w) => ({ id: w.id, name: w.name }))

  console.log(`[PERF] query.fetchManagerDashboardData ${elapsed()}ms`)

  return {
    visibleRegisters,
    activeInvestments,
    managementUsers,
    otherCategories: refData.otherCategories.map((c) => ({ id: c.id, name: c.name })),
    expenseCategories: refData.expenseCategories.map((c) => ({ id: c.id, name: c.name })),
    isAdminOrOwner,
  }
}
