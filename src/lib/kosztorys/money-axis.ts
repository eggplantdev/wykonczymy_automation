import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/column-config'

// The grid's second reading axis: the owner reads netto when settling with a subcontractor and brutto
// when invoicing the client, and never both in one sitting. It composes with the column picker rather
// than replacing it — visible(col) = pickerAllows(col) AND axisAllows(col) — so the two answer
// different questions and can't contradict.

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

// The Podsumowanie panel's own default. It opens on netto; „Mieszana" ('both') is now the
// cash-settlement view, not a both-columns readout, so it must not be the panel's opening state.
export const SUMMARY_AXIS_DEFAULT: MoneyAxisT = 'net'

// Netto/brutto visibility flags for a footer/readout at this axis. Shared so every summary block
// derives them one way.
export function axisShows(axis: MoneyAxisT): { net: boolean; gross: boolean } {
  return {
    net: axis === 'net' || axis === 'both',
    gross: axis === 'gross' || axis === 'both',
  }
}

export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean {
  if (AXIS_EXEMPT_COLUMNS.has(toggleKey) || axis === 'both') return true

  const columnAxis = COLUMN_MONEY_AXIS[toggleKey]
  if (columnAxis === undefined) return true
  if (axis === 'none') return false
  return columnAxis === axis
}
