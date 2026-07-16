import type { ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/types/kosztorys'

// `null` = the figure has no answer for this row (no denominator), rendered as a dash by every
// formatter here rather than as a 0 that would read as a real measurement.
export const fmtOrDash = (value: number | null) => (value == null ? '—' : fmt(value))

type ComputedCellDataT = {
  compute: (r: KosztorysV2RowT) => number | null
  className: string | ((r: KosztorysV2RowT) => string)
  format: (value: number | null) => string
}

// Module-level so every computed column shares ONE component identity. An inline `component:
// ({rowData}) => …` is a fresh function type on each assembleV2Columns call (every render), which
// makes react-datasheet-grid remount each computed cell's DOM instead of reconciling it — the
// per-cell compute/format travels via `columnData` instead. Not a remount `key` (see EX-422,
// lessons.md:119-135): identity is stabilised, the grid stays reactive.
function ComputedCell({ rowData, columnData }: CellProps<KosztorysV2RowT, ComputedCellDataT>) {
  const { compute, className, format } = columnData
  return (
    <span
      className={`block w-full px-2 text-left ${typeof className === 'function' ? className(rowData) : className}`}
    >
      {format(compute(rowData))}
    </span>
  )
}

export function computedColumn(
  id: string,
  titleNode: ReactNode,
  compute: (r: KosztorysV2RowT) => number | null,
  className: string | ((r: KosztorysV2RowT) => string) = 'text-muted-foreground',
  format: (value: number | null) => string = fmtOrDash,
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    disabled: true,
    columnData: { compute, className, format },
    component: ComputedCell,
  }
}
