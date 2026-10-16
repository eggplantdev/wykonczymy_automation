'use client'

import { History, Redo2, Settings, SheetIcon, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxRow,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { CleanItemTextsMenuItem } from '@/components/kosztorys/editor/actions/clean-item-texts-action'
import { FillTranslationsMenuItem } from '@/components/kosztorys/editor/actions/fill-translations-action'
import { SaveVersionMenuItem } from '@/components/kosztorys/editor/actions/save-version-action'
import { ClearKosztorysMenuItem } from '@/components/kosztorys/editor/actions/clear-kosztorys-action'
import { SavePresetMenuItem } from '@/components/kosztorys/editor/actions/save-preset-action'
import { ReloadPresetMenuItem } from '@/components/kosztorys/editor/actions/reload-preset-action'
import { SheetCompareMenuItem } from '@/components/kosztorys/editor/actions/sheet-compare-action'
import { KosztorysInvestorMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-investor-menu'
import { KosztorysWorkersMenu } from '@/components/kosztorys/editor/toolbar/menus/kosztorys-workers-menu'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { ClearKosztorysDialog } from '@/components/kosztorys/editor/dialogs/clear-kosztorys-dialog'
import { ReorderMenuItem } from '@/components/kosztorys/editor/actions/reorder-action'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/preset/save-preset-dialog'
import { ReloadFromPresetDialog } from '@/components/kosztorys/editor/dialogs/preset/reload-from-preset-dialog'
import { SheetCompareDialog } from '@/components/kosztorys/editor/dialogs/sheet/sheet-compare-dialog'
import { CatalogueCompareDialog } from '@/components/kosztorys/editor/dialogs/catalogue/catalogue-compare-dialog'
import { KosztorysClientViewDialog } from '@/components/kosztorys/editor/dialogs/view-settings/kosztorys-client-view-dialog'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/share/kosztorys-share-dialog'
import { KosztorysWorkerShareDialog } from '@/components/kosztorys/editor/dialogs/share/kosztorys-worker-share-dialog'
import { KosztorysWorkerViewDialog } from '@/components/kosztorys/editor/dialogs/view-settings/kosztorys-worker-view-dialog'
import {
  AcceptanceProtocolDialog,
  type AcceptanceProtocolSourceT,
} from '@/components/kosztorys/editor/dialogs/acceptance-protocol-dialog'

export function KosztorysActionsMenu({
  protocolSource,
}: {
  protocolSource?: AcceptanceProtocolSourceT
}) {
  const {
    onOpenVersions,
    openImport,
    hasSheet,
    undo,
    redo,
    canUndo,
    canRedo,
    readOnly,
    fitRowsToContent,
    toggleFitRowsToContent,
    isTemplate,
    isTrashed,
    noun,
  } = useKosztorysEditorContext()

  return (
    <>
      {/* A trashed investment's
          links refuse to open, so its menus would only hand out dead ones. */}
      {!isTemplate && !isTrashed && (
        <>
          <KosztorysWorkersMenu />
          <KosztorysInvestorMenu hasProtocol={protocolSource != null} />
        </>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            <Settings />
            Opcje
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel>Edycja</DropdownMenuLabel>
          {!readOnly && (
            <>
              <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
                <Undo2 />
                <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
                <Redo2 />
                <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
              </DropdownMenuItem>
              <ReorderMenuItem />
              {!isTemplate && <CleanItemTextsMenuItem />}
              <FillTranslationsMenuItem />
            </>
          )}
          <DropdownMenuCheckboxRow
            checked={fitRowsToContent}
            onCheckedChange={toggleFitRowsToContent}
            label={
              <MenuItemBody
                label="Dopasuj wysokość wierszy"
                description="Każdy wiersz rośnie do swojego opisu, zamiast ucinać go na jednej linii."
              />
            }
          />
          {!readOnly && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Wersje</DropdownMenuLabel>
              <SaveVersionMenuItem />
              <DropdownMenuItem onSelect={onOpenVersions}>
                <History />
                <MenuItemBody
                  label="Wczytaj"
                  description={`Przywróć ${noun.nominative} do wcześniej zapisanego stanu.`}
                />
              </DropdownMenuItem>
              <ClearKosztorysMenuItem />
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Szablony</DropdownMenuLabel>
          <SavePresetMenuItem />
          {!readOnly && <ReloadPresetMenuItem />}
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
      <KosztorysWorkerShareDialog />
      <KosztorysWorkerViewDialog />
      {protocolSource && <AcceptanceProtocolDialog source={protocolSource} />}
    </>
  )
}
