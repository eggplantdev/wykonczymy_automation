import { CHROME_COLUMN_IDS } from '@/lib/kosztorys/grid-column-ids'

type SizableColumnT = { id?: string; minWidth?: number; maxWidth?: number }
type ColumnSpanT = { min: { col: number }; max: { col: number } }

export function isFixedWidth(column: SizableColumnT): boolean {
  return column.minWidth != null && column.minWidth === column.maxWidth
}

// A pinned width also renders as minWidth === maxWidth, so "fixed" alone would misread every column
// the user has already resized as one that can't be.
function isResizable(column: SizableColumnT, widths: Record<string, number>): boolean {
  if (!column.id || CHROME_COLUMN_IDS.has(column.id)) return false
  return !isFixedWidth(column) || widths[column.id] === column.minWidth
}

export function resizableColumnIds(
  columns: SizableColumnT[],
  widths: Record<string, number>,
): string[] {
  return columns.flatMap((column) => (column.id && isResizable(column, widths) ? [column.id] : []))
}

export function selectionTargetIds(
  columns: SizableColumnT[],
  widths: Record<string, number>,
  selection: ColumnSpanT | null | undefined,
  clickedId: string,
): string[] {
  const span = selection ? columns.slice(selection.min.col, selection.max.col + 1) : []
  const inSpan = span.some((column) => column.id === clickedId)
  const candidates = inSpan ? span : columns.filter((column) => column.id === clickedId)
  return resizableColumnIds(candidates, widths)
}
