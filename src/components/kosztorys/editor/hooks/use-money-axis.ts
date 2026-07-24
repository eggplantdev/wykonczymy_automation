'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-enum'
import { MONEY_AXIS_DEFAULT, type MoneyAxisT } from '@/lib/kosztorys/money-axis'

// Active money axis, persisted globally in localStorage: a reading preference of the person, not of one
// kosztorys, so unlike usePriceView the key carries no investment id. Filed under the `table-columns:`
// family because it answers "which columns do I want" — clearing the picker's memory clears this too.
const STORAGE_KEY = 'table-columns:kosztorys-axis'
const VALID_AXES: readonly MoneyAxisT[] = ['net', 'gross', 'both', 'none']

export function useMoneyAxis(): [MoneyAxisT, (axis: MoneyAxisT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_AXES, MONEY_AXIS_DEFAULT)
}
