import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import {
  EXPENSE_DRAFT_STATUS_LABELS,
  type ExpenseDraftStatusT,
} from '@/lib/constants/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'

const STATUS_TONES: Record<ExpenseDraftStatusT, string> = {
  pending: BADGE_TONE.pending,
  accepted: BADGE_TONE.positive,
  rejected: BADGE_TONE.muted,
}

export function DraftStatusBadge({ status }: { status: ExpenseDraftStatusT }) {
  return (
    <span className={cn(BADGE_BASE, STATUS_TONES[status])}>
      {EXPENSE_DRAFT_STATUS_LABELS[status]}
    </span>
  )
}
