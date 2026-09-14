'use client'

import { MoreHorizontal } from 'lucide-react'

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

// The body-cell twin of HeaderMenuTrigger: it fills its whole grid cell so the click target matches
// what the user sees as "the Akcje cell", while the visible chrome sits on an inner span — which is
// what keeps the hover/open highlight the size of a button rather than the size of the cell.
export function CellMenuTrigger({ title }: { title: string }) {
  return (
    <DropdownMenuTrigger
      title={title}
      className="group flex size-full cursor-pointer items-center justify-center outline-none"
    >
      <span className="text-foreground group-hover:bg-accent group-hover:text-accent-foreground group-data-[state=open]:bg-accent flex size-6 items-center justify-center rounded-md transition-colors">
        <MoreHorizontal className="size-3.5" />
      </span>
    </DropdownMenuTrigger>
  )
}
