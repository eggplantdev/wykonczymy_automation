import { formatPLN } from '@/lib/utils/format-currency'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { cn } from '@/lib/utils/cn'
import { Description } from '@/components/ui/description'
import { InfoTooltip } from '@/components/ui/info-tooltip'

export const signedMoneyColor = (amount: number) => {
  // Rounded before the sign test, or a balance that renders „0,00" gets painted red by a −1e-13 residue.
  const rounded = roundToCents(amount)
  return rounded > 0 ? 'text-chart-green' : rounded < 0 ? 'text-destructive' : 'text-foreground'
}

type SignedMoneyDisplayPropsT = {
  amount: number
  label?: string
  tooltip?: string
  selectionCount?: { selected: number; total: number }
}

export function SignedMoneyDisplay({
  amount,
  label = 'Saldo',
  tooltip,
  selectionCount,
}: SignedMoneyDisplayPropsT) {
  return (
    <Description withIcon={false}>
      {label}:{' '}
      <span className={cn('font-semibold', signedMoneyColor(amount))}>{formatPLN(amount)}</span>
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
