'use client'

import { flexRender, type HeaderGroup } from '@tanstack/react-table'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { SimpleTooltip } from '@/components/ui/tooltip'
import { TABLE_TEXT_SIZE, type TableTextSizeT } from './table-text-size'

type TableHeaderPropsT<T> = {
  headerGroups: HeaderGroup<T>[]
  textSize: TableTextSizeT
}

export function TableHeader<T>({ headerGroups, textSize }: TableHeaderPropsT<T>) {
  const sizes = TABLE_TEXT_SIZE[textSize]
  return (
    <thead>
      {headerGroups.map((headerGroup) => (
        <tr key={headerGroup.id} className="border-border bg-muted/50 border-b">
          {headerGroup.headers.map((header) => {
            const canSort = header.column.getCanSort()
            const sorted = header.column.getIsSorted()
            const align = header.column.columnDef.meta?.align
            const tooltip = header.column.columnDef.meta?.tooltip
            const minWidth = header.column.columnDef.meta?.minWidth
            const description = header.column.columnDef.meta?.description
            const isVertical = header.column.columnDef.meta?.vertical
            const rawHeader = header.column.columnDef.header

            // The header itself is the trigger, matching the kosztorys grid — no (i) icon competing
            // for width with the sort arrow. Radix closes the tip on pointerdown, so the click that
            // sorts also dismisses it instead of leaving it hanging over the re-sorted table.
            const content = (
              <span
                className={cn(
                  'inline-flex items-center gap-1',
                  isVertical ? 'whitespace-normal' : 'whitespace-nowrap',
                )}
              >
                {header.isPlaceholder ? null : flexRender(rawHeader, header.getContext())}
                {canSort && <SortIcon sorted={sorted} />}
              </span>
            )

            const label = tooltip ? (
              <SimpleTooltip content={tooltip}>{content}</SimpleTooltip>
            ) : (
              content
            )

            return (
              <th
                key={header.id}
                className={cn(
                  'text-muted-foreground px-3 py-2 text-left font-medium',
                  sizes.header,
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                  canSort && 'cursor-pointer select-none',
                  isVertical && 'text-center align-bottom',
                  minWidth,
                )}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
              >
                {isVertical ? (
                  // Left-aligned explicitly: a right-aligned label, once rotated, pins a wrapped one
                  // to the top while a one-line one sits at the bottom. `h-max` is the line length:
                  // left to the browser, a vertical box takes it from its ancestors' heights, which
                  // in an auto-height dialog wrapped „Pomiar z natury” one word per line and spilled
                  // the column's text into its neighbour. The flex wrapper is for WebKit: straight in
                  // the cell, a vertical box counts as ONE line toward the column's minimum width, so
                  // a squeezed column spilled its description (or a wrapped label) into the next one.
                  <span className="flex justify-center">
                    <span className="vertical-text h-max max-h-48 text-left">
                      {label}
                      {description && (
                        <span className={cn('block font-normal', sizes.headerDescription)}>
                          {description}
                        </span>
                      )}
                    </span>
                  </span>
                ) : (
                  <>
                    {label}
                    {description && (
                      // Capped, or the auto layout would squeeze it down to its longest word.
                      <span
                        className={cn(
                          'block w-max max-w-40 font-normal whitespace-normal',
                          sizes.headerDescription,
                          align === 'right' && 'ml-auto',
                        )}
                      >
                        {description}
                      </span>
                    )}
                  </>
                )}
              </th>
            )
          })}
        </tr>
      ))}
    </thead>
  )
}

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ArrowUp className="size-3.5" />
  if (sorted === 'desc') return <ArrowDown className="size-3.5" />
  return <ArrowUpDown className="size-3.5 opacity-40" />
}
