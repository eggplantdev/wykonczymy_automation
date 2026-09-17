import type { SortingState } from '@tanstack/react-table'

// Payload's sort parameter format: `-amount` descending, `amount` ascending. Only the first sort
// column survives — a multi-column parameter would have to be validated column by column downstream.

/** The column id inside a sort parameter, i.e. the parameter without its descending `-`. */
export function sortParamColumnId(param: string): string {
  return param.startsWith('-') ? param.slice(1) : param
}

export function sortParamToSortingState(param: string | undefined): SortingState {
  if (!param) return []
  const id = sortParamColumnId(param)
  return id ? [{ id, desc: param.startsWith('-') }] : []
}

/** The empty string means "remove the parameter", not "write the default". */
export function sortingStateToParam(sorting: SortingState): string {
  const first = sorting[0]
  if (!first) return ''
  return first.desc ? `-${first.id}` : first.id
}
