'use client'

import { RotateCcw, TriangleAlert } from 'lucide-react'
import {
  FilterTriggerButton,
  GRID_FILTER_TRIGGER_CLASS,
} from '@/components/filters/filter-trigger-button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { DropdownCheckGroups, type DropdownCheckItemT } from '@/components/ui/dropdown-check-groups'

type PropsT = {
  toggles: readonly DropdownCheckItemT[]
  onSelect: (id: string) => void
}

// The editor's „Problemy" without „Odśwież": nothing on this page holds a fixed praca in place, so
// there is nothing to release.
export function CatalogueProblemsMenu({ toggles, onSelect }: PropsT) {
  if (toggles.length === 0) return null

  const engaged = toggles.find((toggle) => toggle.active)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterTriggerButton
          active={Boolean(engaged)}
          tone="destructive"
          icon={TriangleAlert}
          className={GRID_FILTER_TRIGGER_CLASS}
        >
          Problemy
        </FilterTriggerButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        {engaged && (
          <>
            <DropdownMenuLabel>Zawężenie</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={keepMenuOpen(() => onSelect(engaged.id))}
              className="text-muted-foreground"
            >
              <RotateCcw />
              Zresetuj filtry
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownCheckGroups items={toggles} onSelect={onSelect} />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
