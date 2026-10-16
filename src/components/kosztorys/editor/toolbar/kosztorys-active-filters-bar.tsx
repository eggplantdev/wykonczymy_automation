'use client'

import { ActiveFiltersBar } from '@/components/filters/active-filters-bar'
import {
  activeFiltersModel,
  type ActiveFilterChipT,
} from '@/components/kosztorys/editor/toolbar/active-filters-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

export function KosztorysActiveFiltersBar() {
  const {
    engagedConditionIds,
    toggleCondition,
    toggleConditionExclusive,
    collapsedSectionIds,
    setCollapsedSectionIds,
    search,
    setSearch,
    resetFilters,
    conditionCounts,
  } = useKosztorysEditorContext()

  const chips = activeFiltersModel({
    engagedIds: engagedConditionIds,
    collapsedSectionCount: collapsedSectionIds.size,
    search,
    counts: conditionCounts,
  })

  function remove(chip: ActiveFilterChipT) {
    switch (chip.removal) {
      case 'condition':
        return toggleCondition(chip.id)
      case 'problem':
        // it also hands the
        // plane back, so removing the chip returns the reader to the view the problem took them from.
        return toggleConditionExclusive(chip.id, PROBLEM_IDS)
      case 'sections':
        return setCollapsedSectionIds(new Set())
      case 'search':
        return setSearch('')
    }
  }

  return (
    <ActiveFiltersBar
      chips={chips}
      onRemove={remove}
      onClearAll={resetFilters}
      className="px-4 pb-2"
    />
  )
}
