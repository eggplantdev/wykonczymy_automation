'use client'

import { ChevronDown, History, Redo2, SheetIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { KosztorysActionsProvider } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { CleanDescriptionsMenuItem } from '@/components/kosztorys/editor/actions/clean-descriptions-action'
import { SaveVersionMenuItem } from '@/components/kosztorys/editor/actions/save-version-action'
import { ClearKosztorysMenuItem } from '@/components/kosztorys/editor/actions/clear-kosztorys-action'
import { SavePresetMenuItem } from '@/components/kosztorys/editor/actions/save-preset-action'
import { ReloadPresetMenuItem } from '@/components/kosztorys/editor/actions/reload-preset-action'
import { SheetCompareMenuItem } from '@/components/kosztorys/editor/actions/sheet-compare-action'
import { CatalogueCompareMenuItem } from '@/components/kosztorys/editor/actions/catalogue-compare-action'
import { KosztorysInvestorMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-investor-menu'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { ClearKosztorysDialog } from '@/components/kosztorys/editor/dialogs/clear-kosztorys-dialog'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/save-preset-dialog'
import { ReloadFromPresetDialog } from '@/components/kosztorys/editor/dialogs/reload-from-preset-dialog'
import { SheetCompareDialog } from '@/components/kosztorys/editor/dialogs/sheet-compare-dialog'
import { CatalogueCompareDialog } from '@/components/kosztorys/editor/dialogs/catalogue-compare-dialog'
import { KosztorysClientViewDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-client-view-dialog'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-share-dialog'

// Item and dialog are siblings, never nested — see KosztorysActionsProvider for why.
export function KosztorysActionsMenu() {
  const { onOpenVersions, openImport, hasSheet, undo, redo, canUndo, canRedo, readOnly } =
    useKosztorysEditorContext()

  return (
    <KosztorysActionsProvider>
      <KosztorysInvestorMenu />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Opcje
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          {/* On a zakończona inwestycja everything that writes is gone, „Zapisz wersję" included —
              a snapshot is a write and the server refuses it. „Porównaj z arkuszem" goes with them:
              it refreshes the stored Pomiar in the same pass, so it reads like a comparison and
              writes like an import. What survives is what only READS: saving a szablon off the
              kosztorys, and the katalog comparison. */}
          {!readOnly && (
            <>
              <DropdownMenuLabel>Edycja</DropdownMenuLabel>
              <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
                <Undo2 />
                <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
                <Redo2 />
                <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
              </DropdownMenuItem>
              <CleanDescriptionsMenuItem />
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Wersje</DropdownMenuLabel>
              <SaveVersionMenuItem />
              <DropdownMenuItem onSelect={onOpenVersions}>
                <History />
                <MenuItemBody
                  label="Wczytaj"
                  description="Przywróć kosztorys do wcześniej zapisanego stanu."
                />
              </DropdownMenuItem>
              <ClearKosztorysMenuItem />
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel>Szablony</DropdownMenuLabel>
          <SavePresetMenuItem />
          {!readOnly && <ReloadPresetMenuItem />}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Katalog prac</DropdownMenuLabel>
          <CatalogueCompareMenuItem />
          {/* Both entries can only answer „Inwestycja nie ma kosztorysu." without a linked sheet, and
              both write, so the whole section goes under the lock. */}
          {!readOnly && hasSheet && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Arkusz Google</DropdownMenuLabel>
              <DropdownMenuItem onSelect={openImport}>
                <SheetIcon />
                <MenuItemBody
                  label="Pobierz z arkusza Google…"
                  description="Wczytaj sekcje, prace, stawki i etapy z arkusza podpiętego do tej inwestycji."
                />
              </DropdownMenuItem>
              <SheetCompareMenuItem />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveVersionDialog />
      <SavePresetDialog />
      <SheetCompareDialog />
      <CatalogueCompareDialog />
      <ReloadFromPresetDialog />
      <ClearKosztorysDialog />
      <KosztorysClientViewDialog />
      <KosztorysShareDialog />
    </KosztorysActionsProvider>
  )
}
