'use client'

import { Fragment } from 'react'
import { CheckIcon } from 'lucide-react'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils/cn'

export type DropdownCheckItemT = {
  id: string
  label: string
  // The heading this row sits under. Carried per row rather than as nested arrays so a caller can hand
  // over the list it already has, in the order it already computed.
  groupLabel: string
  active: boolean
}

type PropsT = {
  // Already ordered by group: a heading is emitted where the groupLabel changes, so an interleaved
  // list would print the same heading twice rather than silently regroup behind the caller's back.
  items: readonly DropdownCheckItemT[]
  onSelect: (id: string) => void
}

/**
 * A checkable list under group headings, in the one arrangement the app's menus use for it: heading,
 * rows, separator, next heading — the same shape cmdk's `CommandGroup` gives the „Sekcje" and „Filtry"
 * popovers, for the menus built on Radix's dropdown instead.
 *
 * The check column is always rendered (transparent when off) so the labels line up whether or not
 * anything is ticked, and a label is allowed to wrap: these rows are whole sentences in some menus.
 */
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
        <DropdownMenuItem onSelect={() => onSelect(item.id)}>
          <CheckIcon className={cn('shrink-0', !item.active && 'opacity-0')} />
          <span className="whitespace-normal">{item.label}</span>
        </DropdownMenuItem>
      </Fragment>
    )
  })
}
