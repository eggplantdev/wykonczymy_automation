'use client'

import {
  filtersMenuModel,
  type FilterToggleT,
} from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'

export function useKosztorysFilterMenu(): {
  toggles: (FilterToggleT & { onToggle: () => void })[]
  clear: () => void
} {
  const {
    engagedConditionIds,
    conditionCounts,
    toggleCondition,
    setConditions,
    rows,
    globalDiscount,
    crewAxis,
    isTemplate,
  } = useKosztorysEditorContext()
  const toggles = filtersMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
    rowCount: rows.length,
    perItemDiscountInert: isGlobalDiscountActive(globalDiscount),
    crewAxis,
    isTemplate,
  }).map((toggle) => ({ ...toggle, onToggle: () => toggleCondition(toggle.id) }))

  return {
    toggles,
    clear: () =>
      setConditions(
        toggles.map((toggle) => toggle.id),
        false,
      ),
  }
}
