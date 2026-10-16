export const SERVER_SORTABLE_DRAFT_COLUMNS = [
  'workerName',
  'investmentName',
  'sentAt',
  'status',
  'decidedAt',
] as const

export type ServerSortableDraftColumnT = (typeof SERVER_SORTABLE_DRAFT_COLUMNS)[number]

export const DEFAULT_EXPENSE_DRAFT_SORT = '-sentAt'

export function isServerSortableDraftColumn(
  columnId: string,
): columnId is ServerSortableDraftColumnT {
  return (SERVER_SORTABLE_DRAFT_COLUMNS as readonly string[]).includes(columnId)
}
