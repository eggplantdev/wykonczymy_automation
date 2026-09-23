'use client'

import { ListFilter } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { useKosztorysFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu'

export function KosztorysFiltersMenu() {
  const { toggles, togglesBulk, resetAction } = useKosztorysFilterMenu()

  const triggerCount = toggles.filter((toggle) => !toggle.active).length

  return (
    <FilterMultiSelect
      label="Filtry"
      triggerCount={triggerCount}
      icon={ListFilter}
      title="Co widać: pozycje"
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      contentClassName="w-80"
      resetAction={resetAction}
      toggles={toggles}
      togglesBulk={togglesBulk}
    />
  )
}
