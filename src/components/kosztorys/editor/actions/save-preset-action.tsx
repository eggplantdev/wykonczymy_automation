'use client'

import { useState } from 'react'
import { FileStack } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { listPresetsAction } from '@/lib/actions/kosztorys-presets'
import type { PresetMetaT } from '@/lib/db/presets'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export type SavePresetActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  existingPresets: PresetMetaT[]
  requestOpen: () => void
}

export function useSavePresetAction(): SavePresetActionT {
  const [open, setOpen] = useState(false)
  const [existingPresets, setExistingPresets] = useState<PresetMetaT[]>([])

  function requestOpen() {
    setOpen(true)
    void listPresetsAction().then((res) => {
      if (res.success) setExistingPresets(res.data)
    })
  }

  return { open, setOpen, existingPresets, requestOpen }
}

export function SavePresetMenuItem() {
  const { savePreset } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={savePreset.requestOpen}>
      <FileStack />
      <MenuItemBody
        label="Zapisz jako nowy szablon…"
        description="Zapisz jako wzór do użycia na innych inwestycjach."
      />
    </DropdownMenuItem>
  )
}
