'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  BookmarkPlus,
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
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import { RowHeightMenuItems } from '@/components/kosztorys/editor/grid/menus/row-height-menu-items'
import { SaveItemToCatalogueDialog } from '@/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type PropsT = {
  // „Dopasuj wysokość do treści" measures the row's text, unlike every other command here.
  row: KosztorysV2RowT
  // Under any sort, array position no longer mirrors display_order, so insert + move go dead.
  sortActive: boolean
  // Both false at the ends of a one-praca section; `sortActive` freezes every direction at once.
  canMoveUp: boolean
  canMoveDown: boolean
  // The POZYCJA's id, not a catalogue row's — an id, not a callback, because the dialog fetches by
  // it. Absent in the read-only view → no „Zapisz do katalogu…".
  item: {
    onInsertAbove: () => void
    onInsertBelow: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onRemove: () => void
    savableItemId?: number
  }
}

// Pozycja commands only; sekcja commands hang off the band's own „…", reachable while collapsed.
export function KosztorysRowActionsMenu({ row, sortActive, canMoveUp, canMoveDown, item }: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [catalogueSaveOpen, setCatalogueSaveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-44">
          {/* The band's „…" sits in the same „Akcje" column one row up, so the header is what says
              which of the two objects the menu you opened belongs to. */}
          <DropdownMenuLabel>Praca</DropdownMenuLabel>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertAbove}>
            <ArrowUpToLine />
            Wstaw powyżej
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertBelow}>
            <ArrowDownToLine />
            Wstaw poniżej
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive || !canMoveUp} onSelect={item.onMoveUp}>
            <ArrowUp />
            Przesuń w górę
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive || !canMoveDown} onSelect={item.onMoveDown}>
            <ArrowDown />
            Przesuń w dół
          </DropdownMenuItem>
          {item.savableItemId !== undefined && (
            <DropdownMenuItem onSelect={() => setCatalogueSaveOpen(true)}>
              <BookmarkPlus />
              Zapisz pozycję do katalogu prac
            </DropdownMenuItem>
          )}
          <RowHeightMenuItems row={row} />
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Trash2 />
            Usuń pozycję
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title="Usunąć pozycję?"
        description={REMOVAL_CONFIRM_DESCRIPTION}
        confirmLabel="Usuń"
        onConfirm={() => {
          item.onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
      {/* Mounted only while open: the menu renders once per row, and the dialog fetches on mount. */}
      {catalogueSaveOpen && item.savableItemId !== undefined && (
        <SaveItemToCatalogueDialog
          itemId={item.savableItemId}
          open
          onOpenChange={setCatalogueSaveOpen}
        />
      )}
    </>
  )
}
