import type { TransferTypeT } from '@/lib/constants/transfers'
import type { DateRangeT } from '@/lib/utils/date-range'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'

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
}

/** `null` leaves a dimension unfiltered; an empty list matches nothing (the URL named no valid value). */
export type QueueFiltersT<StatusT extends string> = {
  statuses: StatusT[] | null
  investmentIds: number[] | null
  workerIds: number[] | null
  sentRange: DateRangeT
}

/** One page of a queue plus the filter options its whole history offers. */
export type QueuePageT<RowT> = {
  rows: RowT[]
  paginationMeta: PaginationMetaT
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
}
