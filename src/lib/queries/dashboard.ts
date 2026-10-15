import { canViewRegister, isManagementRole, type RoleT } from '@/lib/auth/roles'
import { toOptions } from '@/lib/utils/build-filter-config'
import type { ReferenceDataBaseT } from '@/types/reference-data'

/**
 * The dashboard table's filter lists, derived from reference data alone — no balances — so the
 * table's own query can start without waiting on the register stats above it.
 */
export function dashboardFilterOptions(refData: ReferenceDataBaseT, role: RoleT) {
  return {
    cashRegisters: toOptions(refData.cashRegisters.filter((cr) => canViewRegister(role, cr.type))),
    investments: toOptions(refData.investments.filter((i) => i.active)),
    users: toOptions(refData.workers.filter((w) => isManagementRole(w.role))),
    otherCategories: toOptions(refData.otherCategories),
    expenseCategories: toOptions(refData.expenseCategories),
  }
}
