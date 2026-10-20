import { Badge, type BadgeToneT } from '@/components/ui/badge'
import type { PayoutStatusT } from '@/lib/constants/payout-status'
import type { TranslatorT } from '@/lib/i18n/translations'
import { payoutStatusLabel } from '@/lib/transfers/transfer-text'

const STATUS_TONES: Record<PayoutStatusT, BadgeToneT> = {
  pending: 'pending',
  accepted: 'positive',
  rejected: 'negative',
}

type PropsT = {
  status: PayoutStatusT
  cancelled: boolean
  translator: TranslatorT<'transfers'>
}

export function PayoutStatusBadge({ status, cancelled, translator }: PropsT) {
  return (
    <Badge tone={cancelled ? 'muted' : STATUS_TONES[status]}>
      {payoutStatusLabel(status, cancelled, translator)}
    </Badge>
  )
}
