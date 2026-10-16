export const SERVER_SORTABLE_LEAD_COLUMNS = [
  'id',
  'source',
  'name',
  'email',
  'phone',
  'formName',
  'submittedAt',
  'contactStatus',
] as const

export type ServerSortableLeadColumnT = (typeof SERVER_SORTABLE_LEAD_COLUMNS)[number]

export const DEFAULT_LEAD_SORT = '-submittedAt'

export function isServerSortableLeadColumn(
  columnId: string,
): columnId is ServerSortableLeadColumnT {
  return (SERVER_SORTABLE_LEAD_COLUMNS as readonly string[]).includes(columnId)
}
