import { type VatPlaneT } from '@/lib/constants/transfers'
import { offPlaneDepositSentence } from '@/lib/kosztorys/off-plane-deposit-copy'
import { AlertIcon } from '@/components/ui/alert-icon'
import type { DepositTransactionRowT } from '@/types/transfers'

// Owner-only, like the robocizna/rabat scream: a client can't act on the tryb and shouldn't see the
// doubt.
//
// Deliberately NOT the bordered `WarningBanner` this replaced (deleted 2026-08-19, owner: „tamten był
// paskudny"): a red block under the settlement, not a boxed paragraph above it. One sentence, no
// per-wpłata list (owner, 2026-08-23) — the wpłaty list sits right below and already marks those same
// rows, so listing them here answered „which ones?" twice.
//
// The sentence lives in `offPlaneDepositSentence` — the investments listing marks the same rows and
// must not word it differently. Why the remedy it names is the tryb rather than re-booking: see
// `isOffPlaneDeposit`.
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
