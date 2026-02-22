export type ReferenceItemT = {
  readonly id: number
  readonly name: string
  readonly type?: string
  readonly active?: boolean
  readonly ownerId?: number
  readonly defaultCashRegisterId?: number
}

export type CashRegisterTypeT = 'MAIN' | 'AUXILIARY' | 'VIRTUAL'

export type CashRegisterRefT = ReferenceItemT & {
  readonly balance: number
}

export type InvestmentRefT = ReferenceItemT & {
  readonly status: 'active' | 'completed'
  readonly totalCosts: number
  readonly totalIncome: number
  readonly laborCosts: number
  readonly address: string
  readonly phone: string
  readonly email: string
  readonly contactPerson: string
}

export type WorkerRefT = ReferenceItemT & {
  readonly email: string
}

export type OtherCategoryRefT = {
  readonly id: number
  readonly name: string
}

export type ReferenceDataBaseT = {
  cashRegisters: CashRegisterRefT[]
  investments: InvestmentRefT[]
  workers: WorkerRefT[]
  otherCategories: OtherCategoryRefT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: string
}
