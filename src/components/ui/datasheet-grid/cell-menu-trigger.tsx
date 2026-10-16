'use client'

import { MoreHorizontal } from 'lucide-react'

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

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
