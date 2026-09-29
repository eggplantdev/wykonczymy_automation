'use client'

import { ArrowDown, ArrowUp, ChevronsUpDown, ListOrdered } from 'lucide-react'

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'
import type { SortDirT, SortPickT, SortScopeT } from '@/lib/kosztorys/row-view'

export type SortMenuPropsT = {
  active: SortPickT | null
  onSort: (pick: SortPickT | null) => void
  // „Zapisz kolejność" — writes the sort showing right now into the stored order, so it survives
  // clearing the sort.
  onPersistOrder?: () => void
}

// The sort block of a header menu, shared so a stage header and an ordinary column header answer the
// same gestures with the same wording — the stage menu carries its own rename/plane/roster sections
// around it, which is why this is a set of items rather than a whole menu.
export function SortMenuItems({ active, onSort, onPersistOrder }: SortMenuPropsT) {
  // Four commands rather than a direction pair plus a scope toggle: direction and scope are picked
  // in one gesture, and no scope can be in force unnoticed.
  function item(dir: SortDirT, scope: SortScopeT, text: string) {
    const DirIcon = dir === 'asc' ? ArrowUp : ArrowDown
    const on = active?.dir === dir && active.scope === scope
    return (
      <DropdownMenuItem onSelect={keepMenuOpen(() => onSort({ dir, scope }))}>
        <DirIcon className={cn(on ? 'opacity-100' : 'opacity-50')} />
        {text}
      </DropdownMenuItem>
    )
  }

  return (
    <>
      {item('asc', 'section', 'Sortuj rosnąco zachowując sekcje')}
      {item('desc', 'section', 'Sortuj malejąco zachowując sekcje')}
      <DropdownMenuSeparator />
      {item('asc', 'global', 'Sortuj rosnąco')}
      {item('desc', 'global', 'Sortuj malejąco')}
      <DropdownMenuSeparator />
      {onPersistOrder && (
        <DropdownMenuItem onSelect={keepMenuOpen(onPersistOrder)}>
          <ListOrdered />
          Zapisz kolejność
        </DropdownMenuItem>
      )}
      <DropdownMenuItem disabled={!active} onSelect={keepMenuOpen(() => onSort(null))}>
        <ChevronsUpDown className="opacity-50" />
        Wyczyść sortowanie
      </DropdownMenuItem>
    </>
  )
}

export function SortIcon({ active }: { active: SortPickT | null }) {
  const Icon = active?.dir === 'asc' ? ArrowUp : active?.dir === 'desc' ? ArrowDown : ChevronsUpDown
  return <Icon className={cn(active ? 'opacity-100' : 'opacity-50')} />
}
