'use client'

import { BookOpenCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function CatalogueCompareMenuItem() {
  const { catalogueCompare } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={() => catalogueCompare.setOpen(true)}>
      <BookOpenCheck />
      <MenuItemBody
        label="Porównaj z katalogiem…"
        description="Sprawdź, gdzie ceny i stawki tego kosztorysu odbiegają od katalogu prac."
      />
    </DropdownMenuItem>
  )
}
