import { formatPLN } from '@/lib/format-currency'

type SaldoSummaryPropsT = {
  saldo: number
  total: number
}

export function SaldoSummary({ saldo, total }: SaldoSummaryPropsT) {
  return (
    <div className="bg-muted/50 border-border mt-6 space-y-1 rounded-lg border px-6 py-4">
      <p className="text-sm">
        Aktualne saldo: <span className="font-medium">{formatPLN(saldo)}</span>
      </p>
      <p className="text-sm">
        Suma wydatków: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <p className="text-sm">
        Saldo po transakcji: <span className="font-medium">{formatPLN(saldo - total)}</span>
      </p>
    </div>
  )
}
