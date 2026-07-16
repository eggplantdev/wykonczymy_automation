import { COLUMN_PROGRESS_DISPLAY } from '@/lib/kosztorys/constants'

// The grid's third reading axis: a stage's progress reads as money or as a percentage. Modelled as a
// checkbox pair (like the money and layer axes), so both readings can show at once or neither — `both`
// shows the money and percent stage columns together, `none` hides both. Composes rather than
// replacing anything — visible(col) = pickerAllows(col) AND axisAllows(col) AND
// progressDisplayAllows(col) — so the picker still wins over any mode that would show a column.

export type ProgressDisplayT = 'values' | 'percent' | 'both' | 'none'

export const PROGRESS_DISPLAY_DEFAULT: ProgressDisplayT = 'values'

export function progressDisplayAllows(toggleKey: string, display: ProgressDisplayT): boolean {
  const columnDisplay = COLUMN_PROGRESS_DISPLAY[toggleKey]
  if (columnDisplay === undefined || display === 'both') return true
  if (display === 'none') return false
  return columnDisplay === display
}
