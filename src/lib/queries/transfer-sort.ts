import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_TRANSFER_SORT, isServerSortableColumn } from '@/lib/transfers/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

/**
 * The one whitelist gate for `?sort=`, shared by the page, the print action and the table state, so
 * a bad value can't diverge between screen and printout. Off-whitelist yields `undefined`, not a
 * throw — degrades to the default order and keeps junk out of the `unstable_cache` key.
 */
export function validTransferSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseTransferSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  return (typeof param === 'string' ? validTransferSort(param) : undefined) ?? DEFAULT_TRANSFER_SORT
}
