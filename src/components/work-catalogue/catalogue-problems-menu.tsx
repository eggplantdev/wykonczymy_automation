'use client'

import { TriangleAlert } from 'lucide-react'
import {
  FilterTriggerButton,
  GRID_FILTER_TRIGGER_CLASS,
} from '@/components/filters/filter-trigger-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownCheckGroups, type DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'

type PropsT = {
  toggles: readonly DropdownCheckItemT[]
  onSelect: (id: string) => void
}

export function CatalogueProblemsMenu({ toggles, onSelect }: PropsT) {
  if (toggles.length === 0) return null

  const isEngaged = toggles.some((toggle) => toggle.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTriggerButton
          active={isEngaged}
          tone="destructive"
          icon={TriangleAlert}
          className={GRID_FILTER_TRIGGER_CLASS}
        >
          Problemy
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownCheckGroups items={toggles} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
