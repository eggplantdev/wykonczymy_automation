import { formatPLN, normalize } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'

export const saldoColor = (amount: number) => {
  const normalizedAmount = normalize(amount)
  return normalizedAmount > 0
    ? 'text-chart-green'
    : normalizedAmount < 0
      ? 'text-destructive'
      : 'text-foreground'
}

type SaldoDisplayPropsT = {
  saldo: number
  label?: string
  tooltip?: string
  selectionCount?: { selected: number; total: number }
}

export function SaldoDisplay({
  saldo,
  label = 'Saldo',
  tooltip,
  selectionCount,
}: SaldoDisplayPropsT) {
  return (
    <Description>
      {label}: <span className={cn('font-semibold', saldoColor(saldo))}>{formatPLN(saldo)}</span>
      {tooltip && (
        <InfoTooltip content={tooltip} label={`Jak liczony jest: ${label}`} className="ml-1" />
      )}
      {selectionCount && (
        <span className="text-muted-foreground ml-2">
          (wybranych {selectionCount.selected}/{selectionCount.total})
        </span>
      )}
    </Description>
  )
}
