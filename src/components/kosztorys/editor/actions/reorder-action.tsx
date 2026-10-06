'use client'

import { ArrowDownUp } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function ReorderMenuItem() {
  const { reorder } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={() => reorder.setOpen(true)}>
      <ArrowDownUp />
      <MenuItemBody
        label="Ustaw kolejność…"
        description="Przeciągaj prace i sekcje na liście — wiele naraz, także między sekcjami."
      />
    </DropdownMenuItem>
  )
}
