'use client'

import { ClipboardCheck } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function AcceptanceProtocolMenuItem() {
  const { acceptanceProtocol } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={() => acceptanceProtocol.setOpen(true)}>
      <ClipboardCheck />
      <MenuItemBody
        label="Protokół odbioru…"
        description="Wydrukuj protokół odbioru z wykonanymi pracami i rozliczeniem netto."
      />
    </DropdownMenuItem>
  )
}
