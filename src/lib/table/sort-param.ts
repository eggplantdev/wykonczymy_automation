import type { SortingState } from '@tanstack/react-table'

export function sortParamColumnId(param: string): string {
  return param.startsWith('-') ? param.slice(1) : param
}

export function sortParamToSortingState(param: string | undefined): SortingState {
  if (!param) return []
  const id = sortParamColumnId(param)
  return id ? [{ id, desc: param.startsWith('-') }] : []
}

export function sortingStateToParam(sorting: SortingState): string {
  const first = sorting[0]
  if (!first) return ''
  return first.desc ? `-${first.id}` : first.id
}
