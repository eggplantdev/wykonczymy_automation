'use client'

import { SpellCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function CleanItemTextsMenuItem() {
  const { cleanItemTexts, treeRewriting } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={cleanItemTexts.start} disabled={treeRewriting}>
      <SpellCheck />
      <MenuItemBody
        label="Popraw literówki w opisie prac i j.m."
        description="Poprawia literówki, zbędne spacje i wielkie litery w opisach, a j.m. ujednolica do zapisu z listy (m², szt, mb, kpl, pkt)."
      />
    </DropdownMenuItem>
  )
}
