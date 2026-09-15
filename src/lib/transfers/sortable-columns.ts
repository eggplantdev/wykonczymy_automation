/**
 * The transfer columns the database can order by — every one a column of `transactions` itself.
 *
 * The seven relational columns (investment, kasy, kategorie, worker, createdBy) are absent on
 * purpose: the row carries only an id under them and the name is joined in after the page is
 * fetched, so `payload.find` with `depth: 0` has nothing to sort on. They narrow by filter instead.
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

/**
 * One default for BOTH the on-screen list and the export, so an unsorted screen and the printout
 * taken from it cannot disagree. `-id` rather than `-date`: a backdated row belongs where it was
 * entered, and the list has always read that way.
 */
export const DEFAULT_TRANSFER_SORT = '-id'

export function isServerSortableColumn(columnId: string): columnId is ServerSortableColumnT {
  return (SERVER_SORTABLE_TRANSFER_COLUMNS as readonly string[]).includes(columnId)
}
