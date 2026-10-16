import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_LEAD_SORT, isServerSortableLeadColumn } from '@/lib/leads/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

export function validLeadSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableLeadColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseLeadSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  return (typeof param === 'string' ? validLeadSort(param) : undefined) ?? DEFAULT_LEAD_SORT
}
