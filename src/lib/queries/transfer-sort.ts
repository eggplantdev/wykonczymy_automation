import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_TRANSFER_SORT, isServerSortableColumn } from '@/lib/transfers/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

export function validTransferSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseTransferSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  return (typeof param === 'string' ? validTransferSort(param) : undefined) ?? DEFAULT_TRANSFER_SORT
}
