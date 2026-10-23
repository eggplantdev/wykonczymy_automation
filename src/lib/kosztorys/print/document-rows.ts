import { applyRowConditions, clientConditionIds } from '@/lib/kosztorys/row-conditions/queries'
import { HAS_MEASURED_QTY_CONDITION_ID } from '@/lib/kosztorys/row-conditions/registry'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The offer's caller asks this BEFORE it opens a print window: a kosztorys whose every pozycja is
 * empty on both axes passes a `rows.length` guard and prints a branded header over an empty table.
 */
export function documentRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  hideEmptyRows: boolean,
  executedOnly = false,
): KosztorysV2RowT[] {
  const conditionIds = clientConditionIds(hideEmptyRows)
  return applyRowConditions(
    rows,
    executedOnly ? new Set([...conditionIds, HAS_MEASURED_QTY_CONDITION_ID]) : conditionIds,
    {
      stages,
      hasSettledMaterial: false,
      divergentPriceRowIds: new Set(),
    },
  )
}
