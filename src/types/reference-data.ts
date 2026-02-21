export type ReferenceItemT = {
  readonly id: number
  readonly name: string
  readonly type?: string
  readonly active?: boolean
  readonly ownerId?: number
  readonly defaultCashRegisterId?: number
}

export type ReferenceDataBaseT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}

export type ReferenceDataT = ReferenceDataBaseT & {
  currentUserId: number
  currentUserRole: string
}
