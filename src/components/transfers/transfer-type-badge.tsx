import { DotBadge } from '@/components/ui/dot-badge'
import { transferColor } from '@/lib/constants/transfers'
import { transferTypeText } from '@/lib/transfers/transfer-text'
import type { TranslatorT } from '@/lib/i18n/translations'
import type { TransferRowT } from '@/types/transfers'

type PropsT = {
  transfer: TransferRowT
  translator: TranslatorT<'transfers'>
  className?: string
}

export function TransferTypeBadge({ transfer, translator, className }: PropsT) {
  return (
    <DotBadge color={transferColor(transfer)} className={className}>
      {transferTypeText(transfer, translator)}
    </DotBadge>
  )
}
