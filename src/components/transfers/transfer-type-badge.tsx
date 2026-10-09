import { cn } from '@/lib/utils/cn'
import { transferColorVar } from '@/lib/constants/transfers'
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
    <span
      className={cn(
        'border-border inline-flex min-w-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-xs font-medium',
        className,
      )}
    >
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: transferColorVar(transfer) }}
      />
      <span className="truncate">{transferTypeText(transfer, translator)}</span>
    </span>
  )
}
