import { countWrappedLines, type MeasureTextWidthT } from '@/lib/utils/text-wrap'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The columns rendered with `longTextColumn` — the only two whose value is prose rather than a
// figure, and so the only two that can need more than one line. Every other column wraps too (the
// cell style is shared), but a kwota or a jednostka has never yet been wide enough to.
export const WRAPPING_COLUMN_IDS = ['description', 'note'] as const

export type WrappingColumnIdT = (typeof WRAPPING_COLUMN_IDS)[number]

// dsg puts a column's class on its header cell and on its body cells, and hands the rendered width
// back to nobody, so this class is the only handle either the width measurement or the clip cue has
// on a specific column's box. It has to be a class rather than a position: the grid virtualizes
// columns HORIZONTALLY, so the cells in the DOM are `[gutter, …the scrolled window]`, not one per
// column.
export function wrapColumnClass(id: WrappingColumnIdT): string {
  return `kosztorys-wrap-${id}`
}

// How many lines ONE text column needs at its current width. A column with no measured width (never
// rendered, or scrolled sideways before it was ever measured) answers one line — the same answer as
// an empty cell, and the only safe one: claiming more would invent a clip nobody can see.
export function columnContentLines(
  row: KosztorysV2RowT,
  id: WrappingColumnIdT,
  widths: Partial<Record<WrappingColumnIdT, number>>,
  measure: MeasureTextWidthT,
): number {
  const width = widths[id]
  const text = row[id]
  if (!width || !text) return 1
  return countWrappedLines(text, width, measure)
}

// How many lines the tallest of a row's text columns needs. Only columns present in `widths` count,
// which is what keeps a column the client cannot see from making their rows taller.
export function rowContentLines(
  row: KosztorysV2RowT,
  widths: Partial<Record<WrappingColumnIdT, number>>,
  measure: MeasureTextWidthT,
): number {
  let lines = 1
  for (const id of WRAPPING_COLUMN_IDS) {
    lines = Math.max(lines, columnContentLines(row, id, widths, measure))
  }
  return lines
}
