type WidthSpecT = { basis?: number; minWidth?: number; shrink?: number }

/**
 * The width below which dsg's columns stop fitting and it starts to overflow.
 *
 * Mirrors dsg's own sizing (`getColumnWidths` + `useColumns` defaults): a column that may shrink
 * floors at its `minWidth` (100 unless set), one that may not keeps its `basis`. The gutter's
 * defaults differ — `basis` 40, `shrink` 0 — so it is passed in already resolved.
 */
export function gridMinWidth(columns: readonly WidthSpecT[], gutterWidth: number): number {
  return columns.reduce(
    (sum, { basis = 0, minWidth = 100, shrink = 1 }) => sum + (shrink > 0 ? minWidth : basis),
    gutterWidth,
  )
}
