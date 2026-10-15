import { canViewRegister, isManagementRole, type RoleT } from '@/lib/auth/roles'
import type { ReferenceDataBaseT } from '@/types/reference-data'

/**
 * The dashboard table's filter lists, derived from reference data alone — no balances — so the
 * table's own query can start without waiting on the register stats above it.
 */
export function dashboardFilterOptions(refData: ReferenceDataBaseT, role: RoleT) {
  return {
    cashRegisters: refData.cashRegisters
      .filter((cr) => canViewRegister(role, cr.type))
      .map((cr) => ({ id: cr.id, name: cr.name })),
    investments: refData.investments
      .filter((i) => i.active)
      .map((i) => ({ id: i.id, name: i.name })),
    users: refData.workers
      .filter((w) => isManagementRole(w.role))
      .map((w) => ({ id: w.id, name: w.name })),
    otherCategories: refData.otherCategories.map((c) => ({ id: c.id, name: c.name })),
    expenseCategories: refData.expenseCategories.map((c) => ({ id: c.id, name: c.name })),
  }
}
