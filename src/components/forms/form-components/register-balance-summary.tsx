import { formatPLN } from '@/lib/utils/format-currency'
import { Panel } from '@/components/ui/panel'
import { SignedMoneyDisplay } from '@/components/ui/signed-money-display'

type RegisterBalanceSummaryPropsT = {
  registerBalance: number
  total: number
  totalLabel?: string
}

export function RegisterBalanceSummary({
  registerBalance,
  total,
  totalLabel = 'Suma wydatków',
}: RegisterBalanceSummaryPropsT) {
  return (
    <Panel tone="muted" className="mt-6 space-y-1 px-6 py-4">
      <SignedMoneyDisplay amount={registerBalance} label="Aktualne saldo" />
      <p className="text-sm">
        {totalLabel}: <span className="font-medium">{formatPLN(total)}</span>
      </p>
      <SignedMoneyDisplay amount={registerBalance - total} label="Saldo po transakcji" />
    </Panel>
  )
}
