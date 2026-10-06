import type { TransferTypeT } from '@/lib/constants/transfers'

export type FilterConfigT = {
  cashRegisters?: { id: number; name: string }[]
  investments?: { id: number; name: string }[]
  users?: { id: number; name: string }[]
  workers?: { id: number; name: string }[]
  otherCategories?: { id: number; name: string }[]
  expenseCategories?: { id: number; name: string }[]
  transferTypes?: readonly TransferTypeT[]
  showPaymentMethodFilter?: boolean
  showCancelledFilter?: boolean
  showSearchFilters?: boolean
  showWorkerDraftsFilter?: boolean
}
