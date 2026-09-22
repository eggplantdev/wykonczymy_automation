'use client'

import { Trash2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'

export function ClearKosztorysMenuItem() {
  const { clear } = useKosztorysActions()
  const { noun } = useKosztorysEditorContext()

  return (
    <DropdownMenuItem variant="destructive" onSelect={() => clear.setOpen(true)}>
      <Trash2 />
      <MenuItemBody
        label={`Wyczyść ${noun.nominative}…`}
        description="Usuwa całą rozpiskę. Stan sprzed zapisze się w „Wersje”."
      />
    </DropdownMenuItem>
  )
}
