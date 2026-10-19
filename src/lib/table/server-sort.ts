import type { ResolvedSearchParamsT } from '@/types/page'
import { sortParamColumnId } from '@/lib/table/sort-param'

export function serverSort<
  const ColumnsT extends readonly string[],
  DefaultT extends string | undefined = undefined,
>(columns: ColumnsT, defaultSort?: DefaultT) {
  function isSortable(columnId: string): columnId is ColumnsT[number] {
    return columns.includes(columnId)
  }

  function valid(param: string | undefined): string | undefined {
    if (!param) return undefined
    return isSortable(sortParamColumnId(param)) ? param : undefined
  }

  function parse(searchParams: ResolvedSearchParamsT): string | DefaultT {
    const param = searchParams.sort
    return (typeof param === 'string' ? valid(param) : undefined) ?? (defaultSort as DefaultT)
  }

  return { columns, isSortable, valid, parse }
}
