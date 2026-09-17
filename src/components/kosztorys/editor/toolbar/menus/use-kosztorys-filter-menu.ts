'use client'

import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

export function useKosztorysFilterMenu(): {
  filters: RowConditionT[]
  resetAction: { label: string; onReset: () => void; disabled: boolean }
} {
  const { engagedConditionIds, collapsedSectionIds, resetFilters, view, globalDiscount, search } =
    useKosztorysEditorContext()

  return {
    filters: offeredFilterConditions(
      engagedConditionIds,
      view,
      isGlobalDiscountActive(globalDiscount),
    ),
    resetAction: {
      label: 'Zresetuj filtry',
      onReset: resetFilters,
      disabled:
        engagedConditionIds.size === 0 && collapsedSectionIds.size === 0 && search.trim() === '',
    },
  }
}
