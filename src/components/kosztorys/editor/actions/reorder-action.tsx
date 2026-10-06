'use client'

import { ArrowDownUp } from 'lucide-react'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { MenuItemBody } from '@/components/kosztorys/editor/actions/menu-item-body'
import { useOpenReorder } from '@/components/kosztorys/editor/actions/reorder-host'

export function ReorderMenuItem({ compact = false }: { compact?: boolean }) {
  const openReorder = useOpenReorder()

  return (
    <DropdownMenuItem onSelect={openReorder}>
      <ArrowDownUp />
      {compact ? (
        'Ustaw kolejność…'
      ) : (
        <MenuItemBody
          label="Ustaw kolejność…"
          description="Przeciągaj prace i sekcje na liście — wiele naraz, także między sekcjami."
        />
      )}
    </DropdownMenuItem>
  )
}
