'use client'

import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { ExpenseDraftStatusT } from '@/lib/db/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'
import type { MessageKeyT } from '@/lib/i18n/translations'

const STATUS_LABELS: Record<ExpenseDraftStatusT, MessageKeyT<'expenseDrafts'>> = {
  pending: 'statusPending',
  accepted: 'statusAccepted',
  rejected: 'statusRejected',
}

const STATUS_TONES: Record<ExpenseDraftStatusT, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  accepted: BADGE_TONE.positive,
  rejected: BADGE_TONE.muted,
}

export function DraftStatusBadge({ status }: { status: ExpenseDraftStatusT }) {
  const { t } = useTranslation('expenseDrafts')
  return <span className={cn(BADGE_BASE, STATUS_TONES[status])}>{t(STATUS_LABELS[status])}</span>
}
