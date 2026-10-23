import { Badge } from '@/components/ui/badge'
import { DECISION_TONE } from '@/components/ui/decision-progress-badge'
import type { PayoutStatusT } from '@/lib/constants/payout-status'
import type { TranslatorT } from '@/lib/i18n/translations'
import { payoutStatusLabel } from '@/lib/transfers/transfer-text'

type PropsT = {
  status: PayoutStatusT
  cancelled: boolean
  translator: TranslatorT<'transfers'>
}

export function PayoutStatusBadge({ status, cancelled, translator }: PropsT) {
  return (
    <Badge tone={cancelled ? 'muted' : DECISION_TONE[status]}>
      {payoutStatusLabel(status, cancelled, translator)}
    </Badge>
  )
}
