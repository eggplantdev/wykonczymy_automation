'use client'

import { Scale as ScaleIcon } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function SheetCompareMenuItem() {
  const { sheetCompare } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={sheetCompare.requestOpen}>
      <ScaleIcon />
      <MenuItemBody
        label="Porównaj z arkuszem…"
        description="Sprawdź, czy arkusz i aplikacja liczą to samo, i odśwież zapisane Pomiary z natury."
      />
    </DropdownMenuItem>
  )
}
