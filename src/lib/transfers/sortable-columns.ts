export const SERVER_SORTABLE_TRANSFER_COLUMNS = [
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
] as const

export type ServerSortableColumnT = (typeof SERVER_SORTABLE_TRANSFER_COLUMNS)[number]

/** `-id` not `-date`: a backdated row belongs where it was entered. */
export const DEFAULT_TRANSFER_SORT = '-id'

export function isServerSortableColumn(columnId: string): columnId is ServerSortableColumnT {
  return (SERVER_SORTABLE_TRANSFER_COLUMNS as readonly string[]).includes(columnId)
}
