'use client'

import { Info } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type NotePopoverPropsT = {
  note: string | null
}

export function NotePopover({ note }: NotePopoverPropsT) {
  if (!note) return null

  return (
    <Popover>
      <PopoverTrigger
        aria-label="Pokaż notatkę"
        // Match InvoiceCell's ghost icon-button footprint so the adjacent Faktura/Notatka icons align.
        className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex size-9 cursor-pointer items-center justify-center rounded-md transition-colors outline-none"
      >
        <Info className="h-4 w-4 shrink-0" />
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 overflow-y-auto">
        <p className="text-sm wrap-break-word whitespace-pre-line">{note}</p>
      </PopoverContent>
    </Popover>
  )
}
