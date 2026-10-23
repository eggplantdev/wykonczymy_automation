'use client'

import { MoveHorizontal, RotateCcw } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'

type PropsT = {
  count: number
  onOpenDialog: () => void
  onReset: () => void
}

export function ColumnWidthHeaderItems({ count, onOpenDialog, onReset }: PropsT) {
  const isMany = count > 1

  return (
    <>
      <DropdownMenuItem onSelect={onOpenDialog}>
        <MoveHorizontal />
        {isMany ? (
          `Szerokość kolumn (${count})…`
        ) : (
          <MenuItemBody
            label="Szerokość kolumny…"
            description="Zaznacz kilka kolumn (przeciągnij po nagłówkach lub Shift+klik), żeby ustawić je naraz."
          />
        )}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={onReset}>
        <RotateCcw />
        {isMany ? `Przywróć domyślną szerokość (${count})` : 'Przywróć domyślną szerokość'}
      </DropdownMenuItem>
    </>
  )
}
