import { countWrappedLines, type MeasureTextWidthT } from '@/lib/utils/text-wrap'
import { planePriceKeyParts } from '@/lib/kosztorys/plane-price-keys'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Every column is measured by default — an allowlist is how „Komentarz do pracy" shipped without
// ever growing a row. Excluded: a column whose copied value is a code rather than the label it
// shows, which would size the row for a word nobody sees, and „j.m.", whose combobox never wraps, so
// a taller row would show nothing more. A plane-qualified id is matched by its base.
const UNMEASURED_COLUMN_IDS: ReadonlySet<string> = new Set([
  'reviewStatus',
  'discountType',
  'priceMode',
  'unit',
])

export type MeasuredColumnT = { id: string; text: (row: KosztorysV2RowT) => string }

export type ColumnWidthsT = Readonly<Record<string, number>>

type CopyableColumnT = {
  id?: string
  copyValue?: (opt: { rowData: KosztorysV2RowT; rowIndex: number }) => number | string | null
}

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
export function columnLines(
  row: KosztorysV2RowT,
  columns: readonly MeasuredColumnT[],
  widths: ColumnWidthsT,
  measure: MeasureTextWidthT,
): ReadonlyMap<string, number> {
  return new Map(
    columns.map(({ id, text }) => {
      const width = widths[id]
      const value = width ? text(row) : ''
      return [id, value ? countWrappedLines(value, width, measure) : 1]
    }),
  )
}

export function rowContentLines(lines: ReadonlyMap<string, number>): number {
  return Math.max(1, ...lines.values())
}
