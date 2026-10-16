'use client'

import { useRef, useState } from 'react'
import { ReadOnlyCellText } from '@/components/ui/datasheet-grid/read-only-cell-text'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

// Click, not hover: the preview is read on a phone as often as on a desktop, and a hover
// tooltip has no touch equivalent.
export function ReadOnlyLongText({ value }: { value: string | null }) {
  const textRef = useRef<HTMLSpanElement>(null)
  const [open, setOpen] = useState(false)

  if (!value) return <ReadOnlyCellText>{''}</ReadOnlyCellText>

  return (
    <Popover open={open} onOpenChange={(next) => setOpen(next && isTruncated(textRef.current))}>
      <PopoverTrigger asChild>
        {/* The wrapper is what globals.css clips to the row, so it — not the text inside it — is
            what knows whether the value still fits. */}
        <span ref={textRef} className="block w-full min-w-0">
          <ReadOnlyCellText className="cursor-pointer">{value}</ReadOnlyCellText>
        </span>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="max-h-64 w-80 overflow-auto p-3 text-sm whitespace-pre-wrap"
      >
        {value}
      </PopoverContent>
    </Popover>
  )
}

function isTruncated(node: HTMLSpanElement | null): boolean {
  return node ? node.scrollHeight > node.clientHeight : false
}
