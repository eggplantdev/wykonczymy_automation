/**
 * Transfer columns the database can order by — only `transactions`' own columns. Relational
 * columns (investment, kasy, kategorie, worker, createdBy) are excluded: they carry only an id at
 * `depth: 0`, with names joined in after fetch, so there's nothing to sort on. They narrow by filter instead.
 */
export const SERVER_SORTABLE_TRANSFER_COLUMNS = [
  'id',
  'date',
  'amount',
  'type',
  'paymentMethod',
  'description',
  'vatPlane',
  'createdAt',
] as const

export type ServerSortableColumnT = (typeof SERVER_SORTABLE_TRANSFER_COLUMNS)[number]

/** One default for both the list and its export, so they can't disagree. `-id` not `-date`: a backdated row belongs where it was entered. */
export const DEFAULT_TRANSFER_SORT = '-id'

export function isServerSortableColumn(columnId: string): columnId is ServerSortableColumnT {
  return (SERVER_SORTABLE_TRANSFER_COLUMNS as readonly string[]).includes(columnId)
}
