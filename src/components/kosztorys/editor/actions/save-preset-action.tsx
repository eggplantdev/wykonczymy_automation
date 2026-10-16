'use client'

import { useState } from 'react'
import { FileStack } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { getPresetOptions } from '@/lib/queries/preset-pickers'
import { settleAction } from '@/lib/utils/settle-action'
import type { TemplateMetaT } from '@/lib/db/templates'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export type SavePresetActionT = {
  open: boolean
  setOpen: (open: boolean) => void
  existingPresets: TemplateMetaT[]
  requestOpen: () => void
}

export function useSavePresetAction(): SavePresetActionT {
  const [open, setOpen] = useState(false)
  const [existingPresets, setExistingPresets] = useState<TemplateMetaT[]>([])

  function requestOpen() {
    setOpen(true)
    void settleAction(getPresetOptions).then((res) => {
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
