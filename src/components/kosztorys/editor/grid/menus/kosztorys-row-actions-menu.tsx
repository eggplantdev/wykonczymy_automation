'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpToLine, BookmarkPlus, Trash2 } from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu'
import { CellMenuTrigger } from '@/components/ui/datasheet-grid/cell-menu-trigger'
import { REMOVAL_CONFIRM_DESCRIPTION } from '@/components/kosztorys/editor/grid/menus/removal-confirm'
import { ReorderMenuItem } from '@/components/kosztorys/editor/actions/reorder-action'
import { RowHeightMenuItems } from '@/components/kosztorys/editor/grid/menus/row-height-menu-items'
import { SaveItemToCatalogueDialog } from '@/components/kosztorys/editor/dialogs/catalogue/save-item-to-catalogue-dialog'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

type PropsT = {
  row: KosztorysV2RowT
  sortActive: boolean
  item: {
    onInsertAbove: () => void
    onInsertBelow: () => void
    onRemove: () => void
    savableItemId?: number
  }
}

export function KosztorysRowActionsMenu({ row, sortActive, item }: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [catalogueSaveOpen, setCatalogueSaveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <CellMenuTrigger title="Akcje wiersza" />
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuLabel>Praca</DropdownMenuLabel>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertAbove}>
            <ArrowUpToLine />
            Wstaw powyżej
          </DropdownMenuItem>
          <DropdownMenuItem disabled={sortActive} onSelect={item.onInsertBelow}>
            <ArrowDownToLine />
            Wstaw poniżej
          </DropdownMenuItem>
          <ReorderMenuItem compact />
          {item.savableItemId !== undefined && (
            <DropdownMenuItem onSelect={() => setCatalogueSaveOpen(true)}>
              <BookmarkPlus />
              {row.catalogueItemId === null
                ? 'Zapisz pozycję do katalogu prac'
                : 'Aktualizuj pozycję w katalogu prac'}
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
