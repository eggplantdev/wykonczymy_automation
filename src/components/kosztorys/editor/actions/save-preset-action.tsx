'use client'

import { FileStack } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

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
