'use client'

import { ListFilter } from 'lucide-react'
import { TOOLBAR_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { useKosztorysFilterMenu } from '@/components/kosztorys/editor/toolbar/menus/use-kosztorys-filter-menu'

export function KosztorysFiltersMenu() {
  const { toggles, resetAction } = useKosztorysFilterMenu()

  if (toggles.length === 0) return null

  const triggerCount = toggles.filter((toggle) => toggle.active).length

  return (
    <FilterMultiSelect
      label="Filtry"
      triggerCount={triggerCount}
      icon={ListFilter}
      title="Co widać: pozycje"
      intro={{
        heading: 'Pokaż tylko',
        hint: 'Zaznacz, co chcesz widzieć. Nic nie zaznaczone — widać wszystko.',
      }}
      triggerClassName={TOOLBAR_FILTER_TRIGGER_CLASS}
      // a plane heading carries the crew's name, so at 20rem it wrapped onto two lines and the list
      // stopped reading as a list.
      contentClassName="w-112"
      resetAction={resetAction}
      toggles={toggles}
    />
  )
}
