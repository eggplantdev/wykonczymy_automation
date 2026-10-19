'use client'

import Link from 'next/link'
import { Eye, Settings2, Share2 } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useKosztorysActions } from '@/components/kosztorys/editor/actions/kosztorys-actions-context'

export function InvestorPreviewMenuItem() {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <DropdownMenuItem asChild>
      <Link href={`/podglad-inwestora/${investmentId}`} target="_blank">
        <Eye />
        <MenuItemBody label="Podgląd" description="Zobacz kosztorys tak, jak widzi go inwestor." />
      </Link>
    </DropdownMenuItem>
  )
}

export function ClientViewSettingsMenuItem() {
  const { investor } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={investor.requestSettings}>
      <Settings2 />
      <MenuItemBody
        label="Ustawienia podglądu…"
        description="Zdecyduj, które kolumny i pozycje widzi inwestor."
      />
    </DropdownMenuItem>
  )
}

export function ShareMenuItem() {
  const { investor } = useKosztorysActions()

  return (
    <DropdownMenuItem onSelect={investor.requestShare}>
      <Share2 />
      <MenuItemBody
        label="Udostępnij"
        description="Skopiuj link, którym inwestor otworzy kosztorys bez logowania."
      />
    </DropdownMenuItem>
  )
}
