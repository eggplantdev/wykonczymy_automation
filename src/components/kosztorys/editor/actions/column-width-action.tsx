'use client'

import { MoveHorizontal, RotateCcw } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/ui/menu-item-body'
import { useColumnWidthAll } from '@/components/kosztorys/editor/actions/column-width-open'

export function ColumnWidthMenuItems() {
  const command = useColumnWidthAll()
  if (!command) return null

  return (
    <>
      <DropdownMenuItem onSelect={command.openAll}>
        <MoveHorizontal />
        <MenuItemBody
          label="Szerokość wszystkich kolumn…"
          description="Jedna szerokość w pikselach dla każdej widocznej kolumny."
        />
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={command.resetAll}>
        <RotateCcw />
        <MenuItemBody
          label="Przywróć domyślne szerokości"
          description="Cofa ręcznie ustawione szerokości widocznych kolumn."
        />
      </DropdownMenuItem>
    </>
  )
}
