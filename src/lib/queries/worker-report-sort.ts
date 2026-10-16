import type { ResolvedSearchParamsT } from '@/types/page'
import { isServerSortableReportColumn } from '@/lib/kosztorys/worker-report/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

/**
 * `undefined` keeps the queue order — pending first — which no single column expresses.
 */
export function validWorkerReportSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableReportColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseWorkerReportSort(searchParams: ResolvedSearchParamsT): string | undefined {
  const param = searchParams.sort
  return typeof param === 'string' ? validWorkerReportSort(param) : undefined
}
