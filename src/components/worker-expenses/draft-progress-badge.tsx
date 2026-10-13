'use client'

import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { LineItemStatusT } from '@/components/forms/form-fields/collapsible-line-item'
import type { DraftProgressT } from '@/lib/db/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'
import { useTranslation } from '@/hooks/use-translation'

const PARTS = [
  { key: 'accepted', label: 'progressAccepted', tone: BADGE_TONE.positive },
  { key: 'rejected', label: 'progressRejected', tone: BADGE_TONE.negative },
  { key: 'pending', label: 'progressPending', tone: BADGE_TONE.pending },
] as const satisfies readonly { key: LineItemStatusT }[]

type DraftProgressBadgePropsT = {
  progress: DraftProgressT
  // Given only where the badge filters a list; elsewhere it is a plain readout.
  hidden?: ReadonlySet<LineItemStatusT>
  onToggle?: (status: LineItemStatusT) => void
}

export function DraftProgressBadge({ progress, hidden, onToggle }: DraftProgressBadgePropsT) {
  const { t } = useTranslation('expenseDrafts')
  return (
    <span className="flex gap-1">
      {PARTS.filter(({ key }) => progress[key] > 0).map(({ key, label, tone }) => {
        const className = cn(BADGE_BASE, tone, 'w-fit tabular-nums')
        const text = `${t(label)} ${progress[key]}`
        return onToggle ? (
          <button
            key={key}
            type="button"
            aria-pressed={!hidden?.has(key)}
            className={cn(
              className,
              'cursor-pointer',
              hidden?.has(key) && 'line-through opacity-40',
            )}
            onClick={() => onToggle(key)}
          >
            {text}
          </button>
        ) : (
          <span key={key} className={className}>
            {text}
          </span>
        )
      })}
    </span>
  )
}
