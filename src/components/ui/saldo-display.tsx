import { formatPLN } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Description } from '@/components/ui/description'

type SaldoDisplayPropsT = {
  readonly saldo: number
  readonly label?: string
  readonly selectionCount?: { readonly selected: number; readonly total: number }
}

export function SaldoDisplay({ saldo, label = 'Saldo', selectionCount }: SaldoDisplayPropsT) {
  return (
    <Description>
      {label}:{' '}
      <span className={cn('font-semibold', saldo >= 0 ? 'text-chart-green' : 'text-destructive')}>
        {formatPLN(saldo)}
      </span>
      {selectionCount && (
        <span className="text-muted-foreground ml-2">
          (wybranych {selectionCount.selected}/{selectionCount.total})
        </span>
      )}
    </Description>
  )
}
