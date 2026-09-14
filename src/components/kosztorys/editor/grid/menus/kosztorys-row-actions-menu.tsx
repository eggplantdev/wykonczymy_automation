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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import { SaveItemToCatalogueDialog } from '@/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog'

type PropsT = {
  // Insert + move have no meaning against a sorted view — array position no longer mirrors
  // display_order — so they go dead while any sort is on, whatever its scope.
  sortActive: boolean
  // The POZYCJA's id, not a catalogue row's — an id rather than a callback because the dialog reads
  // every figure it shows from the server by it. Absent (read-only view) → no „Zapisz do katalogu…".
  item: {
    onInsertAbove: () => void
    onInsertBelow: () => void
    onMoveUp: () => void
    onMoveDown: () => void
    onRemove: () => void
    savableItemId?: number
  }
}

// Pozycja commands only — every sekcja command hangs off the band's own „…" (see
// kosztorys-section-actions-menu.tsx), which is reachable even while the section is collapsed.
export function KosztorysRowActionsMenu({ sortActive, item }: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [catalogueSaveOpen, setCatalogueSaveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertAbove}>
            <ArrowUpToLine />
            Wstaw powyżej
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertBelow}>
            <ArrowDownToLine />
            Wstaw poniżej
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onMoveUp}>
            <ArrowUp />
            Przesuń w górę
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onMoveDown}>
            <ArrowDown />
            Przesuń w dół
          </DropdownMenuItem>
          {item.savableItemId !== undefined && (
            <DropdownMenuItem onSelect={() => setCatalogueSaveOpen(true)}>
              <BookmarkPlus />
              Zapisz pozycję do katalogu prac
            </DropdownMenuItem>
          )}
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
