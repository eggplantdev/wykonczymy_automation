import { serverSort } from '@/lib/table/server-sort'

/** No default: an absent sort keeps the queue order — pending first — which no single column expresses. */
export const workerReportSort = serverSort([
  'investmentName',
  'workerName',
  'sentAt',
  'lineCount',
  'status',
])

export type ServerSortableReportColumnT = (typeof workerReportSort.columns)[number]
