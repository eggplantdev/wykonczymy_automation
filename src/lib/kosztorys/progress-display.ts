import { COLUMN_PROGRESS_DISPLAY } from '@/lib/kosztorys/constants'

// The grid's third reading axis: a stage's progress is either money or a percentage — asking for both
// at once doubles the stage block to say the same thing twice. Composes like the money axis rather
// than replacing anything — visible(col) = pickerAllows(col) AND axisAllows(col) AND
// progressDisplayAllows(col) — so the picker still wins over any mode that would show a column.

export type ProgressDisplayT = 'values' | 'percent'

export const PROGRESS_DISPLAY_DEFAULT: ProgressDisplayT = 'values'

export function progressDisplayAllows(toggleKey: string, display: ProgressDisplayT): boolean {
  const columnDisplay = COLUMN_PROGRESS_DISPLAY[toggleKey]
  return columnDisplay === undefined || columnDisplay === display
}
