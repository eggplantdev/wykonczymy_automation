import { type VatPlaneT } from '@/lib/constants/transfers'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { WarningBanner } from '@/components/ui/warning-banner'
import type { DepositTransactionRowT } from '@/types/transfers'

export function SettlementPlaneWarning({
  rows,
  mode,
}: {
  rows: DepositTransactionRowT[]
  mode: VatPlaneT
}) {
  const atStake = rows.reduce((sum, row) => sum + row.amount, 0)

  return (
    <WarningBanner bordered={false} className="max-w-lg">
      {offPlaneDepositSentence({ count: rows.length, amount: atStake }, mode)}
    </WarningBanner>
  )
}
