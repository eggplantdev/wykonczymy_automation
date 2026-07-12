'use client'

import { MessageSquareText } from 'lucide-react'
import { RevealPopover } from '@/components/ui/reveal-popover'

type NotePopoverPropsT = {
  note: string | null
}

// Notes are multi-line (FV number + one line per purchased item) and legacy ones can be a single
// very long string — either blows the auto-layout table column open, so the trigger truncates to one line.
export function NotePopover({ note }: NotePopoverPropsT) {
  if (!note) return null

  return (
    <RevealPopover
      triggerClassName="hover:text-foreground flex max-w-64 items-center gap-1 text-sm transition-colors"
      trigger={
        <>
          <MessageSquareText className="text-muted-foreground h-4 w-4 shrink-0" />
          <span className="min-w-0 truncate">{note}</span>
        </>
      }
    >
      <p className="text-sm break-words whitespace-pre-line">{note}</p>
    </RevealPopover>
  )
}
