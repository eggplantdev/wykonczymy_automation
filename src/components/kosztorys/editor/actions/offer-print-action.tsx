'use client'

import { FileText } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { readClientViewSettings } from '@/lib/queries/client-view-settings-endpoint'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'
import { useOfferPrint } from '@/components/kosztorys/editor/actions/use-offer-print'

export function GenerateOfferMenuItem() {
  const { investmentId } = useKosztorysEditorContext()
  const { investor } = useKosztorysActions()
  const printOffer = useOfferPrint()

  function handlePrint() {
    printOffer(
      investor.clientView ??
        (() => readClientViewSettings(investmentId).then((read) => read.settings)),
    )
  }

  return (
    <DropdownMenuItem onSelect={handlePrint}>
      <FileText />
      <MenuItemBody
        label="Wygeneruj ofertę w PDF"
        description="Otwiera okno wydruku — zapisz jako PDF lub drukuj."
      />
    </DropdownMenuItem>
  )
}
