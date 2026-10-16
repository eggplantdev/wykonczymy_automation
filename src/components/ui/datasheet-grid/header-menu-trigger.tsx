'use client'

import type * as React from 'react'

import { DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

export function HeaderMenuTrigger({
  className,
  ...props
}: React.ComponentProps<typeof DropdownMenuTrigger>) {
  return (
    <DropdownMenuTrigger
      className={cn(
        'hover:bg-accent flex h-full w-full cursor-pointer items-center gap-2 rounded px-1 text-left outline-none',
        className,
      )}
      {...props}
    />
  )
}
