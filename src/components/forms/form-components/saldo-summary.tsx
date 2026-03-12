import { formatPLN } from '@/lib/format-currency'
import { SaldoDisplay } from '@/components/ui/saldo-display'

type SaldoSummaryPropsT = {
  readonly saldo: number
  readonly total: number
}

export function SaldoSummary({ saldo, total }: SaldoSummaryPropsT) {
  return (
    <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
      <SaldoDisplay saldo={saldo} label="Aktualne saldo" />
      <p className="text-sm">
        Suma wydatków: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <SaldoDisplay saldo={saldo - total} label="Saldo po transakcji" />
    </div>
  )
}
