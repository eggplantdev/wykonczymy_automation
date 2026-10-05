import type { ResolvedSearchParamsT } from '@/types/page'
import { isServerSortableReportColumn } from '@/lib/kosztorys/worker-report/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

/**
 * The whitelist gate for `?sort=`, shared by the page and the table's header state, so a hand-edited
 * parameter can't leave the header arrow pointing somewhere the rows were never ordered by.
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
