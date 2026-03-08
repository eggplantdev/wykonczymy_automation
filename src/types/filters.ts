export type FilterConfigT = {
  readonly cashRegisters?: { id: number; name: string }[]
  readonly investments?: { id: number; name: string }[]
  readonly users?: { id: number; name: string }[]
  readonly workers?: { id: number; name: string }[]
  readonly otherCategories?: { id: number; name: string }[]
  readonly showTypeFilter?: boolean
  readonly showPaymentMethodFilter?: boolean
}
