export type ReferenceItemT = {
  readonly id: number
  readonly name: string
  readonly type?: string
  readonly active?: boolean
  readonly ownerId?: number
  readonly defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL'

export type CashRegisterRefT = ReferenceItemT

export type InvestmentRefT = ReferenceItemT & {
  readonly status: 'active' | 'completed'
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
  readonly notes: string
}

export type WorkerRefT = ReferenceItemT & {
  readonly email: string
}

export type OtherCategoryRefT = {
  readonly id: number
  readonly name: string
}

export type ExpenseCategoryRefT = {
  readonly id: number
  readonly name: string
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
  currentUserRole: string
}
