import { countWrappedLines, type MeasureTextWidthT } from '@/lib/utils/text-wrap'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// The only two columns whose value is prose, so the only two that can need more than one line. Every
// other column wraps too, but a kwota or a jednostka has never yet been wide enough to.
export const WRAPPING_COLUMN_IDS = ['description', 'note'] as const

export type WrappingColumnIdT = (typeof WRAPPING_COLUMN_IDS)[number]

// dsg hands the rendered width back to nobody, so this class is the only handle the measurement and
// the clip cue have on a column's box. A class rather than a position because the grid virtualizes
// columns HORIZONTALLY — the cells in the DOM are `[gutter, …the scrolled window]`.
export function wrapColumnClass(id: WrappingColumnIdT): string {
  return `kosztorys-wrap-${id}`
}

// A column with no measured width (never rendered, or scrolled past before measuring) answers one
// line — claiming more would invent a clip nobody can see.
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

// Only columns present in `widths` count, which keeps a column the client cannot see from making
// their rows taller.
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
