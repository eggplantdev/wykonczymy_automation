import type { RoleT } from '@/lib/auth/roles'
import type { OrderSettingsT } from '@/types/order-settings'
import type { ReferenceDataT } from '@/types/reference-data'

export const referenceDataFor = (currentUserRole: RoleT) =>
  ({
    cashRegisters: [{ id: 1, name: 'Kasa główna', type: 'MAIN' as const }],
    trashedCashRegisters: [],
    trashedInvestments: [],
    trashedWorkers: [],
    investments: [],
    workers: [],
    otherCategories: [],
    expenseCategories: [],
    currentUserId: 1,
    currentUserRole,
  }) satisfies ReferenceDataT

export const orderSettingsFixture: OrderSettingsT = {
  suppliers: [],
  bigBagPrice: 800,
  containerPrice: 1500,
  defaultBigBagSupplierId: undefined,
  defaultContainerSupplierId: undefined,
}
