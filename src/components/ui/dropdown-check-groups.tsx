'use client'

import { Fragment } from 'react'
import { CheckIcon } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  keepMenuOpen,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

export type DropdownCheckItemT = {
  id: string
  label: string
  groupLabel: string
  active: boolean
}

type PropsT = {
  // Already ordered by group: a heading is emitted where the groupLabel changes, so an interleaved list would print the same heading twice.
  items: readonly DropdownCheckItemT[]
  onSelect: (id: string) => void
}

export function DropdownCheckGroups({ items, onSelect }: PropsT) {
  return items.map((item, index) => {
    const opensGroup = item.groupLabel !== items[index - 1]?.groupLabel

    return (
      <Fragment key={item.id}>
        {opensGroup && (
          <>
            {index > 0 && <DropdownMenuSeparator />}
            <DropdownMenuLabel>{item.groupLabel}</DropdownMenuLabel>
          </>
        )}
        <DropdownMenuItem onSelect={keepMenuOpen(() => onSelect(item.id))}>
          <CheckIcon className={cn('shrink-0', !item.active && 'opacity-0')} />
          <span className="whitespace-normal">{item.label}</span>
        </DropdownMenuItem>
      </Fragment>
    )
  })
}
