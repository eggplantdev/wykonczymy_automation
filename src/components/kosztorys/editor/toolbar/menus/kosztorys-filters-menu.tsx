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
      intro={{ heading: 'Widoczne pozycje', hint: 'Odznacz, żeby ukryć.' }}
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      // „Problemy"'s width, not the rest of the toolbar's menus: a plane row carries the crew's name in
      // brackets, so at 20rem it wrapped onto two lines and the list stopped reading as a list.
      contentClassName="w-112"
      resetAction={resetAction}
      toggles={toggles}
      togglesBulk={togglesBulk}
    />
  )
}
