'use client'

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ClientViewSettingsMenuItem,
  InvestorPreviewMenuItem,
  ShareMenuItem,
} from '@/components/kosztorys/editor/actions/investor-actions'
import { GenerateOfferMenuItem } from '@/components/kosztorys/editor/actions/offer-print-action'
import { AcceptanceProtocolMenuItem } from '@/components/kosztorys/editor/actions/acceptance-protocol-action'

export function KosztorysInvestorMenu({ hasProtocol }: { hasProtocol: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye />
          Inwestor
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <InvestorPreviewMenuItem />
        <GenerateOfferMenuItem />
        {hasProtocol && <AcceptanceProtocolMenuItem />}
        <ClientViewSettingsMenuItem />
        <ShareMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
