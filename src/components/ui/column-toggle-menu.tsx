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
import { useTranslation } from '@/hooks/use-translation'

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
  footer?: ReactNode
  hint?: ReactNode
  hiddenCount?: number
  align?: 'start' | 'end'
  className?: string
  contentClassName?: string
}

const COLUMN_SEARCH_THRESHOLD = 8

export function ColumnToggleMenu({
  items,
  onToggle,
  onToggleAll,
  order,
  sections,
  footer,
  hint,
  hiddenCount,
  align = 'end',
  className,
  contentClassName = 'w-72',
}: PropsT) {
  const { t } = useTranslation('filters')
  const [orderOpen, setOrderOpen] = useState(false)

  if (items.length === 0 && !sections && !footer) return null

  const allVisible = items.every((item) => item.visible)
  const badgeCount = hiddenCount ?? items.filter((item) => !item.visible).length

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Settings2 />
            {badgeCount > 0 ? t('columnsHidden', { count: badgeCount }) : t('columns')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className={contentClassName}>
          {sections}
          {sections && items.length > 0 && <DropdownMenuSeparator />}
          {items.length > 0 && (
            <>
              <DropdownMenuLabel className="flex items-center justify-between gap-2">
                {t('visibleColumns')}
                {hint}
              </DropdownMenuLabel>
              {order && (
                <DropdownMenuItem onSelect={() => setOrderOpen(true)}>
                  <ArrowUpDown />
                  {t('orderColumnsItem')}
                </DropdownMenuItem>
              )}
              {/* stop keydowns from reaching
                  the Radix menu so its typeahead/focus-roving doesn't fight cmdk. */}
              <div
                onKeyDown={(event) => {
                  if (event.key !== 'Escape') event.stopPropagation()
                }}
              >
                <Command>
                  {items.length > COLUMN_SEARCH_THRESHOLD && (
                    <CommandInput placeholder={t('searchColumn')} className="h-8" />
                  )}
                  {/* With a footer, one scroll for the whole menu — a nested 300px pane buries whatever follows the list. */}
                  <CommandList className={footer ? 'max-h-none overflow-visible' : undefined}>
                    <CommandItem forceMount onSelect={() => onToggleAll(!allVisible)}>
                      <CheckCheck />
                      {allVisible ? t('hideAll') : t('showAll')}
                    </CommandItem>
                    <CommandEmpty>{t('noColumns')}</CommandEmpty>
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
          {footer && (sections || items.length > 0) && <DropdownMenuSeparator />}
          {footer}
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
