import type { ReferenceDataBaseT } from '@/types/reference-data'
import type { FilterConfigT } from '@/types/filters'

type ExcludeEntityT = 'cashRegisters' | 'investments' | 'workers'

/** Build full filter config from reference data, excluding the implicit entity filter for the current page. */
export function buildFilterConfig(
  refData: ReferenceDataBaseT,
  exclude?: ExcludeEntityT,
): FilterConfigT {
  return {
    cashRegisters:
      exclude !== 'cashRegisters'
        ? refData.cashRegisters.map((c) => ({ id: c.id, name: c.name }))
        : undefined,
    investments:
      exclude !== 'investments'
        ? refData.investments.map((i) => ({ id: i.id, name: i.name }))
        : undefined,
    users: refData.workers.map((w) => ({ id: w.id, name: w.name })),
    workers:
      exclude !== 'workers' ? refData.workers.map((w) => ({ id: w.id, name: w.name })) : undefined,
    otherCategories: refData.otherCategories.map((c) => ({ id: c.id, name: c.name })),
    showPaymentMethodFilter: true,
  }
}
