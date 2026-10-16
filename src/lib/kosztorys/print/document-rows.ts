import { applyRowConditions, clientConditionIds } from '@/lib/kosztorys/row-conditions/queries'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

/**
 * The offer's caller asks this BEFORE it opens a print window: a kosztorys whose every pozycja is
 * empty on both axes passes a `rows.length` guard and prints a branded header over an empty table.
 */
export function documentRows(
  rows: KosztorysV2RowT[],
  stages: KosztorysStageT[],
  hideEmptyRows: boolean,
): KosztorysV2RowT[] {
  return applyRowConditions(rows, clientConditionIds(hideEmptyRows), {
    stages,
    hasSettledMaterial: false,
    divergentPriceRowIds: new Set(),
  })
}
