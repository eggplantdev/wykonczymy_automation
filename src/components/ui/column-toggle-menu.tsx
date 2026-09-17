'use client'

import { useState, type ReactNode } from 'react'
import { ArrowUpDown, CheckCheck, CheckIcon, Settings2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ColumnOrderDialog } from '@/components/ui/column-order-dialog'
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { type ColumnRanksT } from '@/lib/table/column-order'
import { cn } from '@/lib/utils/cn'

export type ColumnToggleItemT = {
  id: string
  label: string
  visible: boolean
}

type ColumnOrderT = {
  description: string
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  onSetRank: (key: string, rank: number) => void
  onReset: () => void
}

type PropsT = {
  items: ColumnToggleItemT[]
  onToggle: (id: string) => void
  onToggleAll: (visible: boolean) => void
  order?: ColumnOrderT
  sections?: ReactNode
  hint?: ReactNode
  // Overrides the derived count where „hidden" and „off screen" come apart — the kosztorys grid
  // shows a column an engaged problem reveals whatever its tick says, and the badge has to answer
  // „czego nie widzę", not „co odznaczyłem".
  hiddenCount?: number
  align?: 'start' | 'end'
  className?: string
}

// Below this the list fits on screen and a search box is just noise; above it (kosztorys stages push
// the column count toward ~50) filtering earns its place.
const COLUMN_SEARCH_THRESHOLD = 8

export function ColumnToggleMenu({
  items,
  onToggle,
  onToggleAll,
  order,
  sections,
  hint,
  hiddenCount,
  align = 'end',
  className,
}: PropsT) {
  const [orderOpen, setOrderOpen] = useState(false)

  if (items.length === 0 && !sections) return null

  const allVisible = items.every((item) => item.visible)
  const badgeCount = hiddenCount ?? items.filter((item) => !item.visible).length

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={cn('gap-1.5', className)}>
            <Settings2 />
            {badgeCount > 0 ? `Kolumny (${badgeCount})` : 'Kolumny'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-72">
          {sections}
          {sections && items.length > 0 && <DropdownMenuSeparator />}
          {items.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                Widoczne kolumny
                {hint}
              </DropdownMenuLabel>
              {order && (
                <DropdownMenuItem onSelect={() => setOrderOpen(true)}>
                  <ArrowUpDown />
                  Ustaw kolejność kolumn…
                </DropdownMenuItem>
              )}
              {/* cmdk owns the search + arrow-nav for the column list; stop keydowns from reaching
                  the Radix menu so its typeahead/focus-roving doesn't fight cmdk. Escape still
                  passes so the menu stays Escape-closable. */}
              <div
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') event.stopPropagation()
                }}
              >
                <Command>
                  {items.length > COLUMN_SEARCH_THRESHOLD && (
                    <CommandInput placeholder="Szukaj kolumny..." className="h-8" />
                  )}
                  <CommandList>
                    {/* forceMount keeps the show/hide-all action visible under any search. */}
                    <CommandItem forceMount onSelect={() => onToggleAll(!allVisible)}>
                      <CheckCheck />
                      {allVisible ? 'Ukryj wszystkie' : 'Pokaż wszystkie'}
                    </CommandItem>
                    <CommandEmpty>Brak kolumn</CommandEmpty>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.label}
                        onSelect={() => onToggle(item.id)}
                      >
                        <CheckIcon className={cn(!item.visible && 'opacity-0')} />
                        {item.label}
                      </CommandItem>
                    ))}
                  </CommandList>
                </Command>
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sibling of the menu, never inside DropdownMenuContent — a dialog mounted in the menu's
          content unmounts with it on close and loses the focus fight. */}
      {order && (
        <ColumnOrderDialog
          open={orderOpen}
          onOpenChange={setOrderOpen}
          items={items}
          description={order.description}
          ranks={order.ranks}
          baseRanks={order.baseRanks}
          onSetRank={order.onSetRank}
          onReset={order.onReset}
        />
      )}
    </>
  )
}
