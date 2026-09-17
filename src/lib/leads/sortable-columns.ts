/**
 * Lead columns the database can order by — `leads`' own columns. `answers` is excluded: it is built
 * after the fetch out of `rawData` + `formQuestions`, so there is nothing to sort on.
 */
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

/** Newest first — the list is a queue of people waiting to be called back. */
export const DEFAULT_LEAD_SORT = '-submittedAt'

export function isServerSortableLeadColumn(
  columnId: string,
): columnId is ServerSortableLeadColumnT {
  return (SERVER_SORTABLE_LEAD_COLUMNS as readonly string[]).includes(columnId)
}
