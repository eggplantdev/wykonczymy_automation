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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { useCataloguePicker } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'

// Each command takes the section id rather than closing over it, so the bundle can ride the band's
// `columnData` as ONE value shared by every band row instead of being rebuilt per section.
export type SectionBandActionsT = {
  onInsert: (sectionId: number, where: 'above' | 'below') => void
  onReorder: (sectionId: number, direction: 'up' | 'down') => void
  onSetColor: (sectionId: number, color: SectionColorKeyT | null) => void
  onRemove: (sectionId: number) => void
}

// No `sortActive` gate, unlike the row menu: a column sort drops the bands from the grid, so this
// menu is not rendered at all while one is on.
export function KosztorysSectionActionsMenu({
  sectionId,
  name,
  itemCount,
  color,
  actions,
}: {
  sectionId: number
  name: string
  itemCount: number
  color: SectionColorKeyT | null
  actions: SectionBandActionsT
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const openCataloguePicker = useCataloguePicker()

  return (
    <>
      <DropdownMenu>
        {/* The tint has to reach the icon itself: the trigger's inner span carries `text-foreground`,
            which a colour on the trigger would lose to. Same `--section-rail` (and same neutral
            fallback) as the band's dot, so an uncoloured section still shows a ⋯. */}
        <CellMenuTrigger
          title="Akcje sekcji"
          className="[&_svg]:text-(--section-rail,var(--color-muted-foreground))"
        />
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem onSelect={() => actions.onInsert(sectionId, 'above')}>
            <ArrowUpToLine />
            Wstaw powyżej
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onInsert(sectionId, 'below')}>
            <ArrowDownToLine />
            Wstaw poniżej
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onReorder(sectionId, 'up')}>
            <ArrowUp />
            Przesuń w górę
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => actions.onReorder(sectionId, 'down')}>
            <ArrowDown />
            Przesuń w dół
          </DropdownMenuItem>
          <SectionColorPicker
            value={color}
            onChange={(next) => actions.onSetColor(sectionId, next)}
          />
          {/* A sekcja command, not a pozycja one: the praca lands at the END of this section. */}
          <DropdownMenuItem onSelect={() => openCataloguePicker(sectionId)}>
            <ListChecks />
            Dodaj pracę z katalogu…
          </DropdownMenuItem>
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
