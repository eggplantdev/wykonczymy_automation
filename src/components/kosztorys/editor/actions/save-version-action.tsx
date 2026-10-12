'use client'

import { Save } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function SaveVersionMenuItem() {
  const { version } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={() => version.setOpen(true)}>
      <Save />
      <MenuItemBody
        label="Zapisz"
        description="Zapisz bieżący stan jako nazwany punkt, do którego możesz wrócić."
      />
    </DropdownMenuItem>
  )
}
