import { cn } from '@/lib/cn'
import { formatPLN } from '@/lib/format-currency'

type BalanceCellPropsT = {
  value: number
  className?: string
}

export function BalanceCell({ value, className }: BalanceCellPropsT) {
  return (
    <span className={cn('font-medium', value < 0 && 'text-destructive', className)}>
      {formatPLN(value)}
    </span>
  )
}
