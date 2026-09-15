import type { SortingState } from '@tanstack/react-table'

/**
 * Translates between TanStack's `SortingState` and Payload's sort parameter (`-amount` descending,
 * `amount` ascending). One place, because both ends of the round trip need it: the table writes the
 * parameter into the URL and the server reads it back.
 *
 * Only the first sort column survives — the tables this serves sort on one column at a time, and a
 * multi-column parameter would have to be validated column by column downstream.
 */
export function sortParamToSortingState(param: string | undefined): SortingState {
  if (!param) return []
  const desc = param.startsWith('-')
  const id = desc ? param.slice(1) : param
  return id ? [{ id, desc }] : []
}

/** Empty state yields an empty string — „remove the parameter", not „write the default". */
export function sortingStateToParam(sorting: SortingState): string {
  const first = sorting[0]
  if (!first) return ''
  return first.desc ? `-${first.id}` : first.id
}
