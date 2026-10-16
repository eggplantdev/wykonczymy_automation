import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { FilterConfigT } from '@/types/filters'
import { TRANSFER_TYPES } from '@/lib/constants/transfers'

type FilterKeyT =
  | 'cashRegisters'
  | 'investments'
  | 'users'
  | 'workers'
  | 'otherCategories'
  | 'expenseCategories'
  | 'type'

export function buildFilterConfig(
  refData: ReferenceDataBaseT,
  exclude?: FilterKeyT | FilterKeyT[],
): FilterConfigT {
  const excluded = exclude ? (Array.isArray(exclude) ? exclude : [exclude]) : []
  const has = (key: FilterKeyT) => !excluded.includes(key)

  return {
    cashRegisters: has('cashRegisters') ? toOptions(refData.cashRegisters) : undefined,
    investments: has('investments') ? toOptions(refData.investments) : undefined,
    users: has('users') ? toOptions(refData.workers) : undefined,
    workers: has('workers') ? toOptions(refData.workers) : undefined,
    otherCategories: has('otherCategories') ? toOptions(refData.otherCategories) : undefined,
    expenseCategories: has('expenseCategories') ? toOptions(refData.expenseCategories) : undefined,
    transferTypes: has('type') ? TRANSFER_TYPES : undefined,
    showPaymentMethodFilter: false,
  }
}

export const toOptions = (items: { id: number; name: string }[]) =>
  items.map(({ id, name }) => ({ id, name }))
