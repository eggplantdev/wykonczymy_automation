import type { ReactNode } from 'react'
import { Column, type CellProps } from 'react-datasheet-grid'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { HintTooltip } from '@/components/ui/tooltip'
import { formatNet as fmt } from '@/lib/kosztorys/format'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// `null` = the figure has no answer for this row (no denominator), rendered as a dash by every
// formatter here rather than as a 0 that would read as a real measurement.
export const fmtOrDash = (value: number | null) => (value == null ? '—' : fmt(value))

// The only two tones a computed cell may take, beyond the muted default — every computed value is a
// derived read-only figure, so muted is the baseline and danger is the sole alarm state (e.g. more
// executed than offered).
type ComputedCellToneT = 'muted' | 'danger'

type ComputedCellFormatT = (value: number | null) => string

type ComputedCellDataT = {
  compute: (r: KosztorysV2RowT) => number | null
  tone: ComputedCellToneT | ((r: KosztorysV2RowT) => ComputedCellToneT)
  emphasize?: boolean
  format: ComputedCellFormatT
  // Per-row explanation, `null` on the rows that need none — a `danger` tone tells the user
  // something is wrong but not what, and a computed cell has nowhere else to say it.
  tip?: (r: KosztorysV2RowT) => string | null
}

// Module-level so every computed column shares ONE component identity. An inline `component:
// ({rowData}) => …` is a fresh function type on each assembleV2Columns call (every render), which
// makes react-datasheet-grid remount each computed cell's DOM instead of reconciling it — the
// per-cell compute/format travels via `columnData` instead. Not a remount `key` (see EX-422,
// lessons.md:119-135): identity is stabilised, the grid stays reactive.
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
