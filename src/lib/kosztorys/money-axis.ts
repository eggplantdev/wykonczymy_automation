import { AXIS_EXEMPT_COLUMNS, COLUMN_MONEY_AXIS } from '@/lib/kosztorys/columns/column-config'
import { basePriceKey } from '@/lib/kosztorys/plane-price-keys'
import type { PriceViewT } from '@/lib/kosztorys/calc'

export type MoneyAxisT = 'net' | 'gross' | 'both' | 'none'

export const MONEY_AXIS_DEFAULT: MoneyAxisT = 'both'

export function axisShows(axis: MoneyAxisT): { net: boolean; gross: boolean } {
  return {
    net: axis === 'net' || axis === 'both',
    gross: axis === 'gross' || axis === 'both',
  }
}

export function effectiveMoneyAxis(view: PriceViewT, axis: MoneyAxisT): MoneyAxisT {
  if (view !== 'client') return 'net'
  return axis === 'none' ? 'both' : axis
}

export function axisAllows(toggleKey: string, axis: MoneyAxisT): boolean {
  const key = basePriceKey(toggleKey)
  if (AXIS_EXEMPT_COLUMNS.has(key) || axis === 'both') return true

  const columnAxis = COLUMN_MONEY_AXIS[key]
  if (columnAxis === undefined) return true
  if (axis === 'none') return false
  return columnAxis === axis
}
