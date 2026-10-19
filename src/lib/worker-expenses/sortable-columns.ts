import { serverSort } from '@/lib/table/server-sort'

export const DEFAULT_EXPENSE_DRAFT_SORT = '-sentAt'

export const expenseDraftSort = serverSort([
  'workerName',
  'investmentName',
  'sentAt',
  'status',
  'decidedAt',
])

export type ServerSortableDraftColumnT = (typeof expenseDraftSort.columns)[number]
