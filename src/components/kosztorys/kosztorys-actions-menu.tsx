'use client'

import { useState } from 'react'
import { ChevronDown, FileStack, History, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SavePresetDialog } from '@/components/kosztorys/save-preset-dialog'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import { saveSnapshotAction } from '@/lib/actions/kosztorys-snapshots'
import type { PresetMetaT } from '@/lib/db/presets'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = {
  investmentId: number
  onOpenVersions: () => void
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
export function KosztorysActionsMenu({ investmentId, onOpenVersions }: PropsT) {
  const [presetOpen, setPresetOpen] = useState(false)
  const [existingPresets, setExistingPresets] = useState<PresetMetaT[]>([])

  // Direct save — a named snapshot auto-labelled with the current timestamp; rename later in "Wczytaj".
  async function handleSaveVersion() {
    const label = new Date().toLocaleString('pl-PL', { dateStyle: 'short', timeStyle: 'short' })
    const res = await saveSnapshotAction(investmentId, label)
    toastMessage(
      res.success ? 'Zapisano wersję' : (res.error ?? 'Nie udało się zapisać wersji'),
      res.success ? 'success' : 'error',
    )
  }

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
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem onSelect={() => void handleSaveVersion()}>
            <Save />
            <MenuItemBody
              label="Zapisz"
              description="Zapisz bieżący stan jako punkt, do którego możesz wrócić."
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
        </DropdownMenuContent>
      </DropdownMenu>
      <SavePresetDialog
        investmentId={investmentId}
        open={presetOpen}
        onOpenChange={setPresetOpen}
        existingPresets={existingPresets}
      />
    </>
  )
}
