import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { PayoutStatusT } from '@/lib/constants/payout-confirmation'
import type { TranslatorT } from '@/lib/i18n/translations'
import { payoutStatusLabel } from '@/lib/transfers/transfer-text'
import { cn } from '@/lib/utils/cn'

const STATUS_TONES: Record<PayoutStatusT, string> = {
  pending: BADGE_TONE.pending,
  accepted: BADGE_TONE.positive,
  rejected: BADGE_TONE.negative,
}

type PropsT = {
  status: PayoutStatusT
  cancelled: boolean
  translator: TranslatorT<'transfers'>
}

export function PayoutStatusBadge({ status, cancelled, translator }: PropsT) {
  return (
    <span className={cn(BADGE_BASE, cancelled ? BADGE_TONE.muted : STATUS_TONES[status])}>
      {payoutStatusLabel(status, cancelled, translator)}
    </span>
  )
}
