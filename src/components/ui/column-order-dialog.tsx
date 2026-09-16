'use client'

import { Reorder, motion } from 'framer-motion'
import { EyeOff, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
} from '@/components/ui/dialog'
import type { ColumnToggleItemT } from '@/components/ui/column-toggle-menu'
import { rankForMove, type ColumnRanksT } from '@/lib/table/column-order'
import { useDraft } from '@/hooks/use-draft'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // The picker's own list, already in grid order — one source for „which columns exist and what are
  // they called", so this window can't disagree with the visibility list beside it.
  items: ColumnToggleItemT[]
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  onSetRank: (key: string, rank: number) => void
  onReset: () => void
  // Where the setting applies — the ranks are per-surface, so the sentence has to name that surface
  // rather than promise it everywhere.
  description: string
}

function sameKeys(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index])
}

// „Ustaw kolejność kolumn…" — a separate surface from the visibility picker on purpose: reordering is
// rare, the picker is not, and one list doing both would need two gestures per row.
//
// Hidden columns stay on the list, greyed and still draggable, so a column's place can be set before
// it is shown — the alternative is show it, drag it, hide it again.
export function ColumnOrderDialog({
  open,
  onOpenChange,
  items,
  ranks,
  baseRanks,
  onSetRank,
  onReset,
  description,
}: PropsT) {
  const keys = items.map((item) => item.id)
  const labels = new Map(items.map((item) => [item.id, item]))

  // The list is driven locally while a drag is in flight and only committed on drop. Writing the
  // rank on every crossing instead would push a store update through the editor context mid-drag,
  // rebuilding the whole grid between frames — that is what made dragging crawl.
  const [order, setOrder] = useDraft(keys, sameKeys)

  // Writes ONE key: the dragged group's new rank. Persisting the whole list would freeze today's
  // default order in every browser (see use-column-order). The key comes from the row that was
  // dragged, so nothing has to be inferred from the two orders.
  function commitOrder(key: string) {
    if (sameKeys(keys, order)) return
    onSetRank(key, rankForMove(keys, key, order.indexOf(key), ranks, baseRanks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-sm">
        <DialogHeader title="Ustaw kolejność kolumn" description={description} />

        {/* layoutScroll + min-h-0: without the first, framer measures drags against a stale scroll
            offset once the list is scrolled; without the second the inner box never shrinks in the
            dialog's flex column, so DialogContent scrolls instead and takes the footer with it. */}
        <motion.div layoutScroll className="min-h-0 overflow-y-auto">
          <Reorder.Group
            axis="y"
            values={order}
            onReorder={setOrder}
            className="flex list-none flex-col gap-1"
          >
            {order.map((key) => {
              const item = labels.get(key)
              const label = item?.label ?? key
              return (
                <Reorder.Item
                  key={key}
                  value={key}
                  onDragEnd={() => commitOrder(key)}
                  className={cn(
                    'bg-background hover:bg-accent flex cursor-grab items-center gap-2 rounded-md border px-2 py-2 text-sm active:cursor-grabbing',
                    item?.visible === false && 'text-muted-foreground',
                  )}
                >
                  <GripVertical className="text-muted-foreground size-4" />
                  {label}
                  {item?.visible === false && <EyeOff className="ml-auto size-4" />}
                </Reorder.Item>
              )
            })}
          </Reorder.Group>
        </motion.div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            disabled={Object.keys(ranks).length === 0}
            onClick={onReset}
          >
            Przywróć domyślną kolejność
          </Button>
          <DialogClose asChild>
            <Button size="sm">Zamknij</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
