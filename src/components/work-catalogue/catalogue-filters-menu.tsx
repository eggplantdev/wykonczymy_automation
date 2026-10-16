'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'

type PropsT = {
  toggles: readonly DropdownCheckItemT[]
  onToggle: (id: string) => void
  resetAction: { label: string; onReset: () => void; disabled: boolean }
}

export function CatalogueFiltersMenu({ toggles, onToggle, resetAction }: PropsT) {
  return (
    <FilterMultiSelect
      label="Filtry"
      triggerCount={toggles.filter((toggle) => toggle.active).length}
      icon={ListFilter}
      title="Co widać: prace"
      intro={{
        heading: 'Pokaż tylko',
        hint: 'Zaznacz, co chcesz widzieć. Nic nie zaznaczone — widać wszystko.',
      }}
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
      resetAction={resetAction}
      toggles={toggles.map((toggle) => ({ ...toggle, onToggle: () => onToggle(toggle.id) }))}
    />
  )
}
