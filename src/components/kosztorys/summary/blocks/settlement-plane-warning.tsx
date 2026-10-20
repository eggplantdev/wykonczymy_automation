import { type VatPlaneT } from '@/lib/constants/transfers'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { Description } from '@/components/ui/description'
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
    <Description tone="error" withIcon size="xs" role="alert" className="max-w-lg gap-2 font-semibold">
      {offPlaneDepositSentence({ count: rows.length, amount: atStake }, mode)}
    </Description>
  )
}
