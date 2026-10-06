'use client'

import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import {
  DRAFT_STATUS_LABEL_KEYS,
  type ExpenseDraftStatusT,
} from '@/lib/constants/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

const STATUS_TONES: Record<ExpenseDraftStatusT, string> = {
  pending: BADGE_TONE.pending,
  accepted: BADGE_TONE.positive,
  rejected: BADGE_TONE.muted,
}

export function DraftStatusBadge({ status }: { status: ExpenseDraftStatusT }) {
  const { t } = useTranslation('expenseDrafts')
  return (
    <span className={cn(BADGE_BASE, STATUS_TONES[status])}>
      {t(DRAFT_STATUS_LABEL_KEYS[status])}
    </span>
  )
}
