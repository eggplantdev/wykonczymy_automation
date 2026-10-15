import { Button } from '@/components/ui/button'
import { GradientSpinner } from '@/components/ui/gradient-spinner'
import type { ReceiptGroupingT } from '@/components/forms/expense-form/bulk-expense-form'
import { cn } from '@/lib/utils/cn'

export function ReceiptSelectionActions({
  grouping,
  className,
}: {
  grouping: ReceiptGroupingT
  className?: string
}) {
  const { selectedIds, disabled, isAcceptBlocked, onDecide } = grouping
  const ids = [...selectedIds]

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2', className)}>
      {disabled && <GradientSpinner />}
      {onDecide && (
        <>
          <Button
            type="button"
            size="sm"
            disabled={ids.length === 0 || disabled || ids.some((id) => isAcceptBlocked?.(id))}
            onClick={() => onDecide(ids, 'accept')}
          >
            Przyjmij zaznaczone
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={ids.length === 0 || disabled}
            onClick={() => onDecide(ids, 'reject')}
          >
            Odrzuć zaznaczone
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
          Połącz zaznaczone w 1 transakcję
        </Button>
      )}
    </div>
  )
}
