'use client'

import { usePersistedEnum } from '@/hooks/use-persisted-value'
import { MONEY_AXIS_DEFAULT, type MoneyAxisT } from '@/lib/kosztorys/money-axis'

const STORAGE_KEY = 'table-columns:kosztorys-axis'
const VALID_AXES: readonly MoneyAxisT[] = ['net', 'gross', 'both', 'none']

export function useMoneyAxis(): [MoneyAxisT, (axis: MoneyAxisT) => void] {
  return usePersistedEnum(STORAGE_KEY, VALID_AXES, MONEY_AXIS_DEFAULT)
}
