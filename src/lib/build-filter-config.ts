import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { FilterConfigT } from '@/types/filters'

type FilterKeyT =
  | 'cashRegisters'
  | 'investments'
  | 'users'
  | 'otherCategories'
  | 'expenseCategories'
  | 'type'

/** Build full filter config from reference data, excluding specified filters (e.g. implicit entity on detail pages). */
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
    otherCategories: has('otherCategories') ? toOptions(refData.otherCategories) : undefined,
    expenseCategories: has('expenseCategories') ? toOptions(refData.expenseCategories) : undefined,
    showTypeFilter: has('type'),
    // Hidden for now - we only use cash for now
    showPaymentMethodFilter: false,
  }
}

const toOptions = (items: { id: number; name: string }[]) =>
  items.map(({ id, name }) => ({ id, name }))
