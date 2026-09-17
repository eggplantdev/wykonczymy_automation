import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_LEAD_SORT, isServerSortableLeadColumn } from '@/lib/leads/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

/**
 * The one whitelist gate for `?sort=`, shared by the page and the table's header state, so a
 * hand-edited parameter can't leave the header arrow pointing somewhere the rows were never ordered
 * by. Off-whitelist yields `undefined`, not a throw — degrades to the default order and keeps junk
 * out of the `unstable_cache` key.
 */
export function validLeadSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableLeadColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseLeadSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  return (typeof param === 'string' ? validLeadSort(param) : undefined) ?? DEFAULT_LEAD_SORT
}
