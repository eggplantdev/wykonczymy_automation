import { Button } from '@/components/ui/button'
import type { ReceiptGroupingT } from '@/components/forms/expense-form/bulk-expense-form'
import { cn } from '@/lib/utils/cn'

export function ReceiptSelectionActions({
  grouping,
  className,
}: {
  grouping: ReceiptGroupingT
  className?: string
}) {
  const { selectedIds, disabled, onDecide } = grouping
  const ids = [...selectedIds]

  return (
    <div className={cn('flex flex-wrap justify-end gap-2', className)}>
      {onDecide && (
        <>
          <Button
            type="button"
            size="sm"
            disabled={ids.length === 0 || disabled}
            onClick={() => onDecide(ids, 'accept')}
          >
            Przyjmij zaznaczone ({ids.length})
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={ids.length === 0 || disabled}
            onClick={() => onDecide(ids, 'reject')}
          >
            Odrzuć zaznaczone ({ids.length})
          </Button>
        </>
      )}
      {grouping.selectableIds.size > 1 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={ids.length < 2 || disabled}
          onClick={grouping.onMerge}
        >
          Połącz zaznaczone ({ids.length})
        </Button>
      )}
    </div>
  )
}
