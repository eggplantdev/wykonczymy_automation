'use client'

import {
  filtersMenuModel,
  type FilterToggleT,
} from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
import { useFilterResetAction } from '@/components/kosztorys/editor/toolbar/menus/use-filter-reset-action'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'

export function useKosztorysFilterMenu(): {
  toggles: (FilterToggleT & { onToggle: () => void })[]
  resetAction: ReturnType<typeof useFilterResetAction>
} {
  const {
    engagedConditionIds,
    conditionCounts,
    toggleCondition,
    rows,
    globalDiscount,
    crewAxis,
    isTemplate,
  } = useKosztorysEditorContext()
  const resetAction = useFilterResetAction()

  const toggles = filtersMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
    rowCount: rows.length,
    perItemDiscountInert: isGlobalDiscountActive(globalDiscount),
    crewAxis,
    isTemplate,
  }).map((toggle) => ({ ...toggle, onToggle: () => toggleCondition(toggle.id) }))

  return { toggles, resetAction }
}
