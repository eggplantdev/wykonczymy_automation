import { countWrappedLines, type MeasureTextWidthT } from '@/lib/utils/text-wrap'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Every column is measured by default — an allowlist is how „Komentarz do pracy" shipped without
// ever growing a row. Excluded: a column whose copied value is a code rather than the label it
// shows, which would size the row for a word nobody sees. A plane-qualified id is matched by its base.
const UNMEASURED_COLUMN_IDS: ReadonlySet<string> = new Set([
  'reviewStatus',
  'discountType',
  'priceMode',
])

export type MeasuredColumnT = { id: string; text: (row: KosztorysV2RowT) => string }

export type ColumnWidthsT = Readonly<Record<string, number>>

// Structural rather than dsg's Column, so this layer stays free of the grid library.
type CopyableColumnT = {
  id?: string
  copyValue?: (opt: { rowData: KosztorysV2RowT; rowIndex: number }) => number | string | null
}

// A column's text is what it copies: the one per-column reading of a cell every column already
// defines. A column that copies nothing has nothing to measure.
export function measuredColumns(columns: readonly CopyableColumnT[]): MeasuredColumnT[] {
  return columns.flatMap(({ id, copyValue }) =>
    id && copyValue && !UNMEASURED_COLUMN_IDS.has(planePriceKeyParts(id)?.base ?? id)
      ? [
          {
            id,
            text: (row: KosztorysV2RowT) => String(copyValue({ rowData: row, rowIndex: 0 }) ?? ''),
          },
        ]
      : [],
  )
}

// dsg hands the rendered width back to nobody, so this class is the only handle the measurement has
// on a column's header box. A class rather than a position because the grid virtualizes columns
// HORIZONTALLY — the cells in the DOM are `[gutter, …the scrolled window]`.
export function wrapColumnClass(id: string): string {
  return `kosztorys-wrap-${id}`
}

export const CLIPPED_CELL_CLASS = 'kosztorys-clipped'

// A column with no measured width (never rendered, or scrolled past before measuring) answers one
// line — claiming more would invent a clip nobody can see.
export function columnContentLines(
  row: KosztorysV2RowT,
  column: MeasuredColumnT,
  widths: ColumnWidthsT,
  measure: MeasureTextWidthT,
): number {
  const width = widths[column.id]
  const text = column.text(row)
  if (!width || !text) return 1
  return countWrappedLines(text, width, measure)
}

// Only columns present in `widths` count, which keeps a column the client cannot see from making
// their rows taller.
export function rowContentLines(
  row: KosztorysV2RowT,
  columns: readonly MeasuredColumnT[],
  widths: ColumnWidthsT,
  measure: MeasureTextWidthT,
): number {
  let lines = 1
  for (const column of columns) {
    lines = Math.max(lines, columnContentLines(row, column, widths, measure))
  }
  return lines
}
