import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/columns/column-config'
import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { PriceViewT } from '@/lib/kosztorys/calc'

// The grid's second reading axis: the owner reads netto when settling with a subcontractor and brutto
// when invoicing the client, and never both in one sitting. It composes with the column picker rather
// than replacing it — visible(col) = pickerAllows(col) AND axisAllows(col) — so the two answer
// different questions and can't contradict.

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

// Netto/brutto visibility flags for a footer/readout at this axis. Shared so every summary block
// derives them one way.
export function axisShows(axis: MoneyAxisT): { net: boolean; gross: boolean } {
  return {
    net: axis === 'net' || axis === 'both',
    gross: axis === 'gross' || axis === 'both',
  }
}

// The axis the grid actually renders at, which is not always the persisted pick. Subcontractor views
// (Z narzędziami / Bez narzędzi) are paid without VAT (EX-558), so brutto is meaningless there and the
// axis locks to netto whatever the picker remembers. 'none' is a column-picker state, not a reading:
// under the client view it would hide every money column, so it reads as 'both'.
export function effectiveMoneyAxis(view: PriceViewT, axis: MoneyAxisT): MoneyAxisT {
  if (view !== 'client') return 'net'
  return axis === 'none' ? 'both' : axis
}

export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean {
  // Both planes of a subcontractor rate answer to the base column's tag — one entry per concept, so
  // the two planes cannot end up on opposite sides of the netto/brutto axis.
  const key = basePriceKey(toggleKey)
  if (AXIS_EXEMPT_COLUMNS.has(key) || axis === 'both') return true

  const columnAxis = COLUMN_MONEY_AXIS[key]
  if (columnAxis === undefined) return true
  if (axis === 'none') return false
  return columnAxis === axis
}
