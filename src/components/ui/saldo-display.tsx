import { formatPLN, normalize } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Description } from '@/components/ui/description'

export const saldoColor = (amount: number) => {
  const normalizedAmount = normalize(amount)
  return normalizedAmount > 0
    ? 'text-chart-green'
    : normalizedAmount < 0
      ? 'text-destructive'
      : 'text-foreground'
}

type SaldoDisplayPropsT = {
  readonly saldo: number
  readonly label?: string
  readonly selectionCount?: { readonly selected: number; readonly total: number }
}

export function SaldoDisplay({ saldo, label = 'Saldo', selectionCount }: SaldoDisplayPropsT) {
  return (
    <Description>
      {label}: <span className={cn('font-semibold', saldoColor(saldo))}>{formatPLN(saldo)}</span>
      {selectionCount && (
        <span className="text-muted-foreground ml-2">
          (wybranych {selectionCount.selected}/{selectionCount.total})
        </span>
      )}
    </Description>
  )
}
