'use client'

import { Badge, type BadgeToneT } from '@/components/ui/badge'
import {
  DRAFT_STATUS_LABEL_KEYS,
  type ExpenseDraftStatusT,
} from '@/lib/constants/worker-expense-drafts'
import { useTranslation } from '@/hooks/use-translation'

const STATUS_TONES: Record<ExpenseDraftStatusT, BadgeToneT> = {
  pending: 'pending',
  accepted: 'positive',
  rejected: 'muted',
}

export function DraftStatusBadge({ status }: { status: ExpenseDraftStatusT }) {
  const { t } = useTranslation('expenseDrafts')
  return <Badge tone={STATUS_TONES[status]}>{t(DRAFT_STATUS_LABEL_KEYS[status])}</Badge>
}
