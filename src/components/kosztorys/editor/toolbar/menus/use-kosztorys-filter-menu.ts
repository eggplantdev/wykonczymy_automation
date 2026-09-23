'use client'

import type { FilterTogglesBulkT } from '@/components/filters/filter-multi-select'
import {
  filtersMenuModel,
  type FilterToggleT,
} from '@/components/kosztorys/editor/toolbar/menus/filters-menu-model'
import { useFilterResetAction } from '@/components/kosztorys/editor/toolbar/menus/use-filter-reset-action'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'

export function useKosztorysFilterMenu(): {
  toggles: (FilterToggleT & { onToggle: () => void })[]
  togglesBulk: FilterTogglesBulkT
  resetAction: ReturnType<typeof useFilterResetAction>
} {
  const { engagedConditionIds, conditionCounts, toggleCondition, setConditions, globalDiscount } =
    useKosztorysEditorContext()
  const resetAction = useFilterResetAction()

  const toggles = filtersMenuModel({
    engagedIds: engagedConditionIds,
    counts: conditionCounts,
    perItemDiscountInert: isGlobalDiscountActive(globalDiscount),
  }).map((toggle) => ({ ...toggle, onToggle: () => toggleCondition(toggle.id) }))

  return {
    toggles,
    // Scoped to the rows the menu is actually showing, never to the whole registry: a zawężenie left
    // off the list has nothing to hide, so engaging it would remove no pozycja and only pull that
    // plane's price columns onto the screen (`revealsColumns`) — with no row in the menu to untick it
    // from. „Zresetuj filtry" is the one control that claims the whole thing.
    //
    // Both halves invert, because a row is TICKED when its condition is NOT engaged: engaging a
    // filter is what hides pozycje, so „wszystkie zaznaczone" means „nothing engaged".
    togglesBulk: {
      allActive: toggles.every((toggle) => toggle.active),
      onToggleAll: (next) =>
        setConditions(
          toggles.map((toggle) => toggle.id),
          !next,
        ),
    },
    resetAction,
  }
}
