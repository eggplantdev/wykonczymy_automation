'use client'

import { Badge } from '@/components/ui/badge'
import { SETTLED_DECISION_TONE } from '@/components/ui/decision-progress-badge'
import {
  DRAFT_STATUS_LABEL_KEYS,
  type ExpenseDraftStatusT,
} from '@/lib/constants/worker-expense-drafts'
import { useTranslation } from '@/hooks/use-translation'

export function DraftStatusBadge({ status }: { status: ExpenseDraftStatusT }) {
  const { t } = useTranslation('expenseDrafts')
  return <Badge tone={SETTLED_DECISION_TONE[status]}>{t(DRAFT_STATUS_LABEL_KEYS[status])}</Badge>
}
