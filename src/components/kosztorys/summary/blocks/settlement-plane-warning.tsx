import { type VatPlaneT } from '@/lib/constants/transfers'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { AlertIcon } from '@/components/ui/alert-icon'
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
    <p
      role="alert"
      className="text-destructive flex max-w-lg items-start gap-2 text-xs font-semibold"
    >
      <AlertIcon className="mt-0.5 size-3.5" />
      <span>{offPlaneDepositSentence({ count: rows.length, amount: atStake }, mode)}</span>
    </p>
  )
}
