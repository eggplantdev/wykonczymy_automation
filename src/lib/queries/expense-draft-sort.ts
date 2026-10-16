import type { ResolvedSearchParamsT } from '@/types/page'
import { isServerSortableDraftColumn } from '@/lib/worker-expenses/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

export function validExpenseDraftSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableDraftColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseExpenseDraftSort(searchParams: ResolvedSearchParamsT): string | undefined {
  const param = searchParams.sort
  return typeof param === 'string' ? validExpenseDraftSort(param) : undefined
}
