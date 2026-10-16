'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'

type PropsT = {
  toggles: readonly DropdownCheckItemT[]
  onToggle: (id: string) => void
  onClear: () => void
}

export function CatalogueFiltersMenu({ toggles, onToggle, onClear }: PropsT) {
  return (
    <FilterMultiSelect
      label="Filtry"
      icon={ListFilter}
      title="Co widać: prace"
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
      toggles={toggles.map((toggle) => ({ ...toggle, onToggle: () => onToggle(toggle.id) }))}
      onClearToggles={onClear}
    />
  )
}
