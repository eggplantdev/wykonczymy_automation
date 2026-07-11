'use client'

import { MessageSquareText } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type NoteCellPropsT = {
  note: string | null
}

// Notes are multi-line (FV number + one line per purchased item) and legacy ones can be a single
// very long string — either blows the auto-layout column open. Cap the cell to one truncated line
// and reveal the full text in a popover on click; `whitespace-pre-line` keeps the per-item newlines.
export function NoteCell({ note }: NoteCellPropsT) {
  if (!note) return null

  return (
    <Popover>
      <PopoverTrigger className="hover:text-foreground flex max-w-64 items-center gap-1 text-sm transition-colors">
        <MessageSquareText className="text-muted-foreground h-4 w-4 shrink-0" />
        <span className="min-w-0 truncate">{note}</span>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-80 w-80 overflow-y-auto">
        <p className="text-sm break-words whitespace-pre-line">{note}</p>
      </PopoverContent>
    </Popover>
  )
}
