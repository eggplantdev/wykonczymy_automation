'use client'

import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  MoreHorizontal,
  Trash2,
} from 'lucide-react'

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
  // False on a section's last item (the "≥1 item per section" invariant) — delete disabled.
  canRemove: boolean
  onInsertAbove: () => void
  onInsertBelow: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onRemove: () => void
}

export function KosztorysRowActionsMenu({
  sortActive,
  canRemove,
  onInsertAbove,
  onInsertBelow,
  onMoveUp,
  onMoveDown,
  onRemove,
}: PropsT) {
  // Insert/move are meaningless against a sorted view. Disabled items are pointer-events-none, so
  // the group is wrapped in a tooltip trigger (which catches the hover the items pass through).
  const insertMoveItems = (
    <>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertAbove}>
        <ArrowUpToLine className="size-4" />
        Wstaw pozycję powyżej
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onInsertBelow}>
        <ArrowDownToLine className="size-4" />
        Wstaw pozycję poniżej
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveUp}>
        <ArrowUp className="size-4" />
        Przesuń w górę
      </DropdownMenuItem>
      <DropdownMenuItem disabled={sortActive} onSelect={onMoveDown}>
        <ArrowDown className="size-4" />
        Przesuń w dół
      </DropdownMenuItem>
    </>
  )

  return (
    <DropdownMenu>
      {/* size-full: whole cell is the click target, else dsg selects the dead space around the icon. */}
      <DropdownMenuTrigger
        title="Akcje wiersza"
        className="text-muted-foreground hover:text-foreground hover:bg-accent flex size-full cursor-pointer items-center justify-center outline-none"
      >
        <MoreHorizontal className="h-4 w-4" />
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
        <DropdownMenuItem
          variant="destructive"
          disabled={!canRemove}
          title={canRemove ? undefined : 'Sekcja musi mieć co najmniej jedną pozycję'}
          onSelect={onRemove}
        >
          <Trash2 className="size-4" />
          Usuń pozycję
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
