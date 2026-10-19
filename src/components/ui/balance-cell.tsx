import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'

type BalanceCellPropsT = {
  value: number
  className?: string
}

export function BalanceCell({ value, className }: BalanceCellPropsT) {
  return (
    <span className={cn('font-medium', roundToCents(value) < 0 && 'text-destructive', className)}>
      {formatPLN(value)}
    </span>
  )
}
