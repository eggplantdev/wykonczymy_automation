export type ReferenceItemT = { readonly id: number; readonly name: string; readonly type?: string }

export type ReferenceDataT = {
  cashRegisters: ReferenceItemT[]
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
  otherCategories: ReferenceItemT[]
}
