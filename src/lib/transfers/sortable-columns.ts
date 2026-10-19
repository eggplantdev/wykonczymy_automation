import { serverSort } from '@/lib/table/server-sort'

/** `-id` not `-date`: a backdated row belongs where it was entered. */
export const DEFAULT_TRANSFER_SORT = '-id'

export const transferSort = serverSort(
  [
    'id',
    'date',
    'amount',
    'type',
    'paymentMethod',
    'description',
    'vatPlane',
    'payoutStatus',
    'payoutDecidedAt',
    'createdAt',
  ],
  DEFAULT_TRANSFER_SORT,
)
