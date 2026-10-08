'use client'

import { ListFilter } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { GRID_FILTER_TRIGGER_CLASS } from '@/components/filters/filter-trigger-button'
import type { DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'

type PropsT = {
  toggles: readonly DropdownCheckItemT[]
  onToggle: (id: string) => void
  // Scoped to the listed rows, never the whole registry: a filter left off the list has nothing to
  // hide, and engaging it would leave a narrowing with no row to untick it from.
  onToggleAll: (ids: string[], visible: boolean) => void
  resetAction: { label: string; onReset: () => void; disabled: boolean }
}

export function CatalogueFiltersMenu({ toggles, onToggle, onToggleAll, resetAction }: PropsT) {
  return (
    <FilterMultiSelect
      label="Filtry"
      triggerCount={toggles.filter((toggle) => !toggle.active).length}
      icon={ListFilter}
      title="Co widać: prace"
      intro={{ heading: 'Widoczne prace', hint: 'Odznacz, żeby ukryć.' }}
      triggerClassName={GRID_FILTER_TRIGGER_CLASS}
      contentClassName="w-112"
      resetAction={resetAction}
      toggles={toggles.map((toggle) => ({ ...toggle, onToggle: () => onToggle(toggle.id) }))}
      togglesBulk={{
        allActive: toggles.every((toggle) => toggle.active),
        onToggleAll: (next) =>
          onToggleAll(
            toggles.map((toggle) => toggle.id),
            next,
          ),
      }}
    />
  )
}
