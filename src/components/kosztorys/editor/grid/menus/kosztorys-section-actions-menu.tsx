'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, Languages, ListChecks, Plus, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { useCataloguePicker } from '@/components/kosztorys/editor/actions/catalogue-picker-host'
import { ReorderMenuItem } from '@/components/kosztorys/editor/actions/reorder-action'
import { SectionTranslationDialog } from '@/components/kosztorys/editor/dialogs/section-translation/section-translation-dialog'
import { SectionColorPicker } from '@/components/kosztorys/editor/grid/menus/section-color-picker'
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import { RowHeightMenuItems } from '@/components/kosztorys/editor/grid/menus/row-height-menu-items'
import type { SectionColorKeyT } from '@/lib/kosztorys/section-colors'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

export type SectionBandActionsT = {
  onInsert: (sectionId: number, where: 'above' | 'below') => void
  onSetColor: (sectionId: number, color: SectionColorKeyT | null) => void
  onRemove: (sectionId: number) => void
  onAddItem: (sectionId: number) => void
}

export function KosztorysSectionActionsMenu({
  row,
  sectionId,
  name,
  itemCount,
  color,
  sortActive,
  actions,
}: {
  row: KosztorysV2RowT
  sectionId: number
  name: string
  itemCount: number
  color: SectionColorKeyT | null
  sortActive: boolean
  actions: SectionBandActionsT
}) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [translationOpen, setTranslationOpen] = useState(false)
  const openCataloguePicker = useCataloguePicker()

  return (
    <>
      <DropdownMenu>
        <CellMenuTrigger title="Akcje sekcji" />
        <DropdownMenuContent align="start" className="min-w-44">
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
          <ReorderMenuItem compact />
          <SectionColorPicker
            value={color}
            onChange={(next) => actions.onSetColor(sectionId, next)}
          />
          <DropdownMenuItem onSelect={() => actions.onAddItem(sectionId)}>
            <Plus />
            Dodaj pracę
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => openCataloguePicker(sectionId)}>
            <ListChecks />
            Dodaj pracę do sekcji…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTranslationOpen(true)}>
            <Languages />
            Tłumaczenie sekcji…
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
      {translationOpen && (
        <SectionTranslationDialog sectionName={name} open onOpenChange={setTranslationOpen} />
      )}
    </>
  )
}
