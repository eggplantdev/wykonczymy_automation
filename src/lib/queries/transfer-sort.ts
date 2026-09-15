import type { ResolvedSearchParamsT } from '@/types/page'
import { DEFAULT_TRANSFER_SORT, isServerSortableColumn } from '@/lib/transfers/sortable-columns'
import { sortParamColumnId } from '@/lib/table/sort-param'

/**
 * The one whitelist gate for `?sort=`. Every channel that can reach `payload.find` with a sort key
 * goes through it — the page hosts, the print action and the table's own state — so a value the
 * screen refuses can never reach the printout. Payload swallows an unresolvable sort path and
 * silently falls back to `-createdAt`, which would otherwise show up as two different orders.
 *
 * Off the whitelist yields `undefined` rather than a throw: a hand-edited URL must degrade to the
 * default list, not a 500. It also keeps junk out of the `unstable_cache` key, which would
 * otherwise gain an entry per bogus value.
 */
export function validTransferSort(param: string | undefined): string | undefined {
  if (!param) return undefined
  return isServerSortableColumn(sortParamColumnId(param)) ? param : undefined
}

export function parseTransferSort(searchParams: ResolvedSearchParamsT): string {
  const param = searchParams.sort
  return (typeof param === 'string' ? validTransferSort(param) : undefined) ?? DEFAULT_TRANSFER_SORT
}
