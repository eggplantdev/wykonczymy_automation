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

// Split out of „Opcje" because serving the client is its own errand — the owner reaches for it
// before sending an offer, not while editing one. Mounted inside KosztorysActionsProvider (see
// KosztorysActionsMenu), which is what its items and their dialogs read from.
export function KosztorysInvestorMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" variant="outline">
          <Eye />
          Widok inwestora
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <InvestorPreviewMenuItem />
        <ClientViewSettingsMenuItem />
        <ShareMenuItem />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
