'use client'

import { ActiveFiltersBar } from '@/components/filters/active-filters-bar'
import {
  activeFiltersModel,
  type ActiveFilterChipT,
} from '@/components/kosztorys/editor/toolbar/active-filters-model'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { PROBLEM_IDS } from '@/lib/kosztorys/problem-conditions'

/**
 * The grid's height is measured on mount and window resize only, so extra rows of chips push its
 * bottom out of view — accepted (owner), since a filter set is read at the top of the screen and a
 * row or two of grid is the cheap half.
 */
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

  // The model names WHAT to undo; the switching-off itself is per-source and lives here, next to the
  // handlers, so the model can stay React-free and testable.
  function remove(chip: ActiveFilterChipT) {
    switch (chip.removal) {
      case 'condition':
        return toggleCondition(chip.id)
      case 'problem':
        // Through the exclusive pick, the same call the „Problemy" list makes — it also hands the
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
