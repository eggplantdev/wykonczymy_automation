'use client'

import { useState } from 'react'
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SimpleTooltip } from '@/components/ui/tooltip'

type PropsT = {
  // Insert + move have no meaning against a price-sorted view — disabled with a hint.
  sortActive: boolean
  // Why delete is blocked (only the empty-sheet floor now), or undefined if removable. Present →
  // delete disabled with the reason in a tooltip (disabled items are pointer-events-none, so a
  // native title never fires).
  removeBlockReason?: string
  // Populated row: delete destroys recorded stage progress, so route through a confirm dialog first.
  removeNeedsConfirm?: boolean
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function KosztorysRowActionsMenu({
  sortActive,
  removeBlockReason,
  removeNeedsConfirm,
  onInsertAbove,
  onInsertBelow,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PropsT) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  // Disabled items are pointer-events-none, so the group is wrapped in a tooltip trigger
  // (which catches the hover the disabled items would otherwise pass through).
  const insertMoveItems = (
    <>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertAbove}>
        <ArrowUpToLine />
        Wstaw pozycję powyżej
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertBelow}>
        <ArrowDownToLine />
        Wstaw pozycję poniżej
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveUp}>
        <ArrowUp />
        Przesuń w górę
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveDown}>
        <ArrowDown />
        Przesuń w dół
      </DropdownMenuItem>
    </>
  )

  const removeItem = (
    <DropdownMenuItem
      variant="destructive"
      disabled={removeBlockReason != null}
      onSelect={() => (removeNeedsConfirm ? setConfirmOpen(true) : onRemove())}
    >
      <Trash2 />
      Usuń pozycję
    </DropdownMenuItem>
  )

  return (
    <>
      <DropdownMenu>
        {/* size-full: whole cell is the click target, else dsg selects the dead space around the icon. */}
        <DropdownMenuTrigger
          title="Akcje wiersza"
          className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-full cursor-pointer items-center justify-center outline-none"
        >
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          {sortActive ? (
            <SimpleTooltip content="Przyciski zablokowane — wyłącz sortowanie kolumn, aby odblokować">
              <div>{insertMoveItems}</div>
            </SimpleTooltip>
          ) : (
            insertMoveItems
          )}
          <DropdownMenuSeparator />
          {removeBlockReason == null ? (
            removeItem
          ) : (
            <SimpleTooltip content={removeBlockReason}>
              <div>{removeItem}</div>
            </SimpleTooltip>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmOpen}
        title="Usunąć pozycję?"
        description="Pozycja i wpisane w niej ilości etapów zostaną usunięte."
        confirmLabel="Usuń"
        onConfirm={() => {
          onRemove()
          setConfirmOpen(false)
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  )
}
