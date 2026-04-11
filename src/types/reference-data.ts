import type { RoleT } from '@/lib/auth/roles'

export type ReferenceItemT = {
  id: number
  name: string
  type?: string
  active?: boolean
  ownerId?: number
  defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL' | 'WORKER'

export type CashRegisterRefT = ReferenceItemT

export type InvestmentRefT = ReferenceItemT & {
  status: 'active' | 'completed'
  address: string
  phone: string
  email: string
  contactPerson: string
  notes: string
  review: string
}

export type WorkerRefT = Omit<ReferenceItemT, 'type'> & {
  type: RoleT
  email: string
}

export type OtherCategoryRefT = {
  id: number
  name: string
}

export type ExpenseCategoryRefT = {
  id: number
  name: string
}

export type ReferenceDataBaseT = {
  cashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  workers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
  expenseCategories: ExpenseCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: RoleT
}
