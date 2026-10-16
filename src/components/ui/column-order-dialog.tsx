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
import { sameItems } from '@/lib/utils/same-items'
import { useDraft } from '@/hooks/use-draft'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

type PropsT = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: ColumnToggleItemT[]
  ranks: ColumnRanksT
  baseRanks: ColumnRanksT
  onSetRank: (key: string, rank: number) => void
  onReset: () => void
  resetDisabled?: boolean
  description: string
}

export function ColumnOrderDialog({
  open,
  onOpenChange,
  items,
  ranks,
  baseRanks,
  onSetRank,
  onReset,
  resetDisabled = Object.keys(ranks).length === 0,
  description,
}: PropsT) {
  const { t } = useTranslation('filters')
  const { t: tCommon } = useTranslation('common')
  const keys = items.map((item) => item.id)
  const labels = new Map(items.map((item) => [item.id, item]))

  // Writing the
  // rank on every crossing instead would push a store update through the editor context mid-drag,
  // rebuilding the whole grid between frames.
  const [order, setOrder] = useDraft(keys, sameItems)

  // Persisting the whole list would freeze today's default order in every browser.
  function commitOrder(key: string) {
    if (sameItems(keys, order)) return
    onSetRank(key, rankForMove(keys, key, order.indexOf(key), ranks, baseRanks))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-dialog-sm">
        <DialogHeader title={t('orderColumnsTitle')} description={description} />

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
          <Button variant="outline" size="sm" disabled={resetDisabled} onClick={onReset}>
            {t('resetOrder')}
          </Button>
          <DialogClose asChild>
            <Button size="sm">{tCommon('close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
