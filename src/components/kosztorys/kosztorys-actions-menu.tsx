'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SaveAsDialog } from '@/components/kosztorys/save-as-dialog'

type PropsT = {
  investmentId: number
  onOpenVersions: () => void
}

// The Save-as dialog is a controlled sibling of the menu, not a child of DropdownMenuContent —
// onSelect closes the menu, so opening the dialog from inside it would fight the menu for focus.
export function KosztorysActionsMenu({ investmentId, onOpenVersions }: PropsT) {
  const [saveOpen, setSaveOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline">
            Zapisz / Wersje
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setSaveOpen(true)}>Zapisz jako…</DropdownMenuItem>
          <DropdownMenuItem onSelect={onOpenVersions}>Wersje</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SaveAsDialog investmentId={investmentId} open={saveOpen} onOpenChange={setSaveOpen} />
    </>
  )
}
