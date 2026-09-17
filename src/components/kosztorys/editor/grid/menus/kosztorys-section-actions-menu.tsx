'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ListChecks,
  Trash2,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { useCataloguePicker } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import { RowHeightMenuItems } from '@/components/kosztorys/editor/grid/menus/row-height-menu-items'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Commands take the section id rather than closing over it, so one bundle rides every band row's
// `columnData` instead of being rebuilt per section.
export type SectionBandActionsT = {
  onInsert: (sectionId: number, where: 'above' | 'below') => void
  onReorder: (sectionId: number, direction: 'up' | 'down') => void
  onSetColor: (sectionId: number, color: SectionColorKeyT | null) => void
  onRemove: (sectionId: number) => void
}

// Under a section-scoped sort the bands stay on screen but insert/reorder refuse to run, so without
// `sortActive` those commands would look live and do nothing.
export function KosztorysSectionActionsMenu({
  row,
  sectionId,
  name,
  itemCount,
  color,
  sortActive,
  canMoveUp,
  canMoveDown,
  actions,
}: {
  // The only entry acting on the ROW, not the sekcja. A band's label is one line, so fitting it
  // always lands at resting height — here the command is the way back from a drag.
  row: KosztorysV2RowT
  sectionId: number
  name: string
  itemCount: number
  color: SectionColorKeyT | null
  sortActive: boolean
  // Off at the first / last sekcja, where `handleReorderSection` has nothing to swap with.
  canMoveUp: boolean
  canMoveDown: boolean
  actions: SectionBandActionsT
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const openCataloguePicker = useCataloguePicker()

  return (
    <>
      <DropdownMenu>
        <CellMenuTrigger title="Akcje sekcji" />
        <DropdownMenuContent align="start" className="min-w-44">
          {/* Twin of the row menu's „Praca" header — this ⋯ and a praca's sit in the same „Akcje"
              column, one row apart. */}
          <DropdownMenuLabel>Sekcja</DropdownMenuLabel>
          <DropdownMenuItem
            disabled={sortActive}
            onSelect={() => actions.onInsert(sectionId, 'above')}
          >
            <ArrowUpToLine />
            Wstaw sekcję powyżej
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sortActive}
            onSelect={() => actions.onInsert(sectionId, 'below')}
          >
            <ArrowDownToLine />
            Wstaw sekcję poniżej
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sortActive || !canMoveUp}
            onSelect={() => actions.onReorder(sectionId, 'up')}
          >
            <ArrowUp />
            Przesuń sekcję w górę
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={sortActive || !canMoveDown}
            onSelect={() => actions.onReorder(sectionId, 'down')}
          >
            <ArrowDown />
            Przesuń sekcję w dół
          </DropdownMenuItem>
          <SectionColorPicker
            value={color}
            onChange={(next) => actions.onSetColor(sectionId, next)}
          />
          {/* Not gated by the sort, unlike the four above: the praca lands at the END of this
              section, so array position — the reason those go dead — is irrelevant. */}
          <DropdownMenuItem onSelect={() => openCataloguePicker(sectionId)}>
            <ListChecks />
            Dodaj pracę z katalogu do sekcji…
          </DropdownMenuItem>
          <RowHeightMenuItems row={row} />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Usuń sekcję
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title={`Usunąć sekcję „${name}" (${itemCount} poz.)?`}
        description={REMOVAL_CONFIRM_DESCRIPTION}
        confirmLabel="Usuń"
        onConfirm={() => {
          actions.onRemove(sectionId)
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
