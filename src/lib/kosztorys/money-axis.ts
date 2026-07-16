import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/constants'

// The grid's second reading axis: the owner reads netto when settling with a subcontractor and brutto
// when invoicing the client, and never both in one sitting. It composes with the column picker rather
// than replacing it — visible(col) = pickerAllows(col) AND axisAllows(col) — so the two answer
// different questions and can't contradict.

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean {
  if (AXIS_EXEMPT_COLUMNS.has(toggleKey) || axis === 'both') return true

  const columnAxis = COLUMN_MONEY_AXIS[toggleKey]
  if (columnAxis === undefined) return true
  if (axis === 'none') return false
  return columnAxis === axis
}
