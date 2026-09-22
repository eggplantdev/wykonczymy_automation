'use client'

import type { FilterTogglesBulkT } from '@/components/filters/filter-multi-select'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { isGlobalDiscountActive } from '@/lib/kosztorys/calc'
import { offeredFilterConditions } from '@/lib/kosztorys/row-conditions/queries'
import type { RowConditionT } from '@/lib/kosztorys/row-conditions/types'

export function useKosztorysFilterMenu(): {
  filters: RowConditionT[]
  togglesBulk: FilterTogglesBulkT
  resetAction: { label: string; onReset: () => void; disabled: boolean }
} {
  const {
    engagedConditionIds,
    collapsedSectionIds,
    setConditions,
    resetFilters,
    view,
    globalDiscount,
    search,
  } = useKosztorysEditorContext()

  const filters = offeredFilterConditions(
    engagedConditionIds,
    view,
    isGlobalDiscountActive(globalDiscount),
  )

  return {
    filters,
    // Scoped to the rows the menu is actually showing, never to the whole registry: the filters of
    // the other plane are not on screen, and a sweep that silently hid pozycje in a view the user
    // isn't looking at would be undone from a menu that never listed them. „Zresetuj filtry" is the
    // one control that claims the whole thing.
    //
    // Both halves invert, because a row is TICKED when its condition is NOT engaged: engaging a
    // filter is what hides pozycje, so „wszystkie zaznaczone" means „nothing engaged".
    togglesBulk: {
      allActive: filters.every((condition) => !engagedConditionIds.has(condition.id)),
      onToggleAll: (next) =>
        setConditions(
          filters.map((condition) => condition.id),
          !next,
        ),
    },
    resetAction: {
      label: 'Zresetuj filtry',
      onReset: resetFilters,
      disabled:
        engagedConditionIds.size === 0 && collapsedSectionIds.size === 0 && search.trim() === '',
    },
  }
}
