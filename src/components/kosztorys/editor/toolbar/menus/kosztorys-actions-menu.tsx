'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Eye, FileStack, History, Redo2, Save, Share2, Undo2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { KosztorysShareDialog } from '@/components/kosztorys/editor/dialogs/kosztorys-share-dialog'
import { SavePresetDialog } from '@/components/kosztorys/editor/dialogs/save-preset-dialog'
import { SaveVersionDialog } from '@/components/kosztorys/editor/dialogs/save-version-dialog'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import type { PresetMetaT } from '@/lib/db/presets'

type PropsT = {
  investmentId: number
  onOpenVersions?: () => void
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
}

// A menu item rendered as icon + label + a muted one-line explanation, so each action says what it
// does inline (a hover tooltip inside an already-open Radix menu fights it for focus).
function MenuItemBody({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-medium">{label}</span>
      <span className="text-muted-foreground text-xs">{description}</span>
    </div>
  )
}

// The Save-preset dialog is a controlled sibling of the menu, not a child of DropdownMenuContent —
// onSelect closes the menu, so opening the dialog from inside it would fight the menu for focus.
export function KosztorysActionsMenu({
  investmentId,
  onOpenVersions,
  undo,
  redo,
  canUndo,
  canRedo,
}: PropsT) {
  const [presetOpen, setPresetOpen] = useState(false)
  const [versionOpen, setVersionOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [existingPresets, setExistingPresets] = useState<PresetMetaT[]>([])

  function handleOpenPreset() {
    setPresetOpen(true)
    void listPresetsAction().then((res) => {
      if (res.success) setExistingPresets(res.data)
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Opcje
            <ChevronDown />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={undo} disabled={!canUndo}>
            <Undo2 />
            <MenuItemBody label="Cofnij" description="Cmd/Ctrl+Z" />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={redo} disabled={!canRedo}>
            <Redo2 />
            <MenuItemBody label="Ponów" description="Cmd/Ctrl+Shift+Z" />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setVersionOpen(true)}>
            <Save />
            <MenuItemBody
              label="Zapisz"
              description="Zapisz bieżący stan jako nazwany punkt, do którego możesz wrócić."
            />
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenVersions}>
            <History />
            <MenuItemBody
              label="Wczytaj"
              description="Przywróć kosztorys do wcześniej zapisanego stanu."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleOpenPreset}>
            <FileStack />
            <MenuItemBody
              label="Zapisz jako szablon…"
              description="Zapisz jako wzór do użycia na innych inwestycjach."
            />
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href={`/podglad-klienta/${investmentId}`} target="_blank">
              <Eye />
              <MenuItemBody
                label="Widok klienta"
                description="Zobacz kosztorys tak, jak widzi go klient."
              />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setShareOpen(true)}>
            <Share2 />
            <MenuItemBody
              label="Udostępnij"
              description="Wygeneruj link, którym klient otworzy kosztorys bez logowania."
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveVersionDialog
        investmentId={investmentId}
        open={versionOpen}
        onOpenChange={setVersionOpen}
      />
      <SavePresetDialog
        investmentId={investmentId}
        open={presetOpen}
        onOpenChange={setPresetOpen}
        existingPresets={existingPresets}
      />
      <KosztorysShareDialog
        investmentId={investmentId}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </>
  )
}
