import type { RoleT } from '@/lib/auth/roles'
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
