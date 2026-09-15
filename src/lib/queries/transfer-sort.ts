import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_TRANSFER_SORT, isServerSortableColumn } from '@/lib/transfers/sortable-columns'

/**
 * Reads `?sort=` into a value `payload.find` can take, refusing anything off the whitelist.
 *
 * Never throws: a hand-edited URL must fall back to the default list, not a 500. The whitelist also
 * keeps junk out of the `unstable_cache` key, which would otherwise gain an entry per bogus value.
 */
export function parseTransferSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  if (typeof param !== 'string' || param === '') return DEFAULT_TRANSFER_SORT

  const columnId = param.startsWith('-') ? param.slice(1) : param
  return isServerSortableColumn(columnId) ? param : DEFAULT_TRANSFER_SORT
}
