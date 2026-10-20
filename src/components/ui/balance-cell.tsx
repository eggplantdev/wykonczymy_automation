import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { isNegativeMoney, roundToCents } from '@/lib/utils/round-to-cents'

type BalanceCellPropsT = {
  value: number
  settled?: boolean
  className?: string
}

export function BalanceCell({ value, settled = false, className }: BalanceCellPropsT) {
  return (
    <span
      className={cn(
        'font-medium',
        isNegativeMoney(value) && 'text-destructive',
        settled && roundToCents(value) === 0 && 'text-chart-green',
        className,
      )}
    >
      {formatPLN(value)}
    </span>
  )
}
