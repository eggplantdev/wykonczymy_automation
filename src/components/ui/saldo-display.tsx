import { formatPLN } from '@/lib/format-currency'
import { cn } from '@/lib/cn'
import { Description } from '@/components/ui/description'

type SaldoDisplayPropsT = {
  readonly saldo: number
  readonly label?: string
}

export function SaldoDisplay({ saldo, label = 'Saldo' }: SaldoDisplayPropsT) {
  return (
    <Description>
      {label}:{' '}
      <span className={cn('font-semibold', saldo >= 0 ? 'text-chart-green' : 'text-destructive')}>
        {formatPLN(saldo)}
      </span>
    </Description>
  )
}
