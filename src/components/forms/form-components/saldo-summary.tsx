import { formatPLN } from '@/lib/utils/format-currency'
import { SaldoDisplay } from '@/components/ui/saldo-display'

type SaldoSummaryPropsT = {
  saldo: number
  total: number
  totalLabel?: string
}

export function SaldoSummary({ saldo, total, totalLabel = 'Suma wydatków' }: SaldoSummaryPropsT) {
  return (
    <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
      <SaldoDisplay saldo={saldo} label="Aktualne saldo" />
      <p className="text-sm">
        {totalLabel}: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <SaldoDisplay saldo={saldo - total} label="Saldo po transakcji" />
    </div>
  )
}
