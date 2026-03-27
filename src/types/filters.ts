export type FilterConfigT = {
  cashRegisters?: { id: number; name: string }[]
  investments?: { id: number; name: string }[]
  users?: { id: number; name: string }[]
  otherCategories?: { id: number; name: string }[]
  expenseCategories?: { id: number; name: string }[]
  showTypeFilter?: boolean
  showPaymentMethodFilter?: boolean
}
