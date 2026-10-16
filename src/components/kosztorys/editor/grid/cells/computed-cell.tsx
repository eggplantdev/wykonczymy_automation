import type { ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { HintTooltip } from '@/components/ui/tooltip'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export const fmtOrDash = (value: number | null) => (value == null ? '—' : fmt(value))

type ComputedCellToneT = 'muted' | 'danger'

type ComputedCellFormatT = (value: number | null) => string

type ComputedCellDataT = {
  compute: (r: KosztorysV2RowT) => number | null
  tone: ComputedCellToneT | ((r: KosztorysV2RowT) => ComputedCellToneT)
  emphasize?: boolean
  format: ComputedCellFormatT
  tip?: (r: KosztorysV2RowT) => string | null
}

// An inline `component: ({rowData}) => …` is a fresh function type on each assembleV2Columns
// call (every render), which makes react-datasheet-grid remount each computed cell's DOM instead of
// reconciling it — the per-cell compute/format travels via `columnData` instead.
function ComputedCell({ rowData, columnData }: CellProps<KosztorysV2RowT, ComputedCellDataT>) {
  const { compute, tone, emphasize, format, tip } = columnData
  const resolvedTone = typeof tone === 'function' ? tone(rowData) : tone
  const text = (
    <ReadOnlyCellText
      muted={resolvedTone === 'muted'}
      danger={resolvedTone === 'danger'}
      emphasize={emphasize}
    >
      {format(compute(rowData))}
    </ReadOnlyCellText>
  )
  const hint = tip?.(rowData)
  // `w-full` on the wrapper span: ReadOnlyCellText is `block w-full`, and an inline-flex
  // parent shrink-wraps it, so without this the wrapped figure stops right-aligning with the
  // untipped cells in the same column.
  return hint ? (
    <HintTooltip content={hint} className="w-full">
      {text}
    </HintTooltip>
  ) : (
    text
  )
}

export type ComputedColumnStyleT = Partial<Pick<ComputedCellDataT, 'tone' | 'emphasize' | 'tip'>>

export function computedColumn(
  id: string,
  titleNode: ReactNode,
  compute: (r: KosztorysV2RowT) => number | null,
  style: ComputedColumnStyleT = {},
  format: ComputedCellFormatT = fmtOrDash,
): Column<KosztorysV2RowT> {
  return {
    id,
    title: titleNode,
    disabled: true,
    columnData: {
      compute,
      tone: style.tone ?? 'muted',
      emphasize: style.emphasize,
      format,
      tip: style.tip,
    },
    component: ComputedCell,
  }
}
