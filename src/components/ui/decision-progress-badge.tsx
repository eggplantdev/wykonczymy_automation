'use client'

import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

export type DecisionStatusT = 'accepted' | 'rejected' | 'pending'

const PARTS = [
  { key: 'accepted', label: 'decisionAccepted', tone: BADGE_TONE.positive },
  { key: 'rejected', label: 'decisionRejected', tone: BADGE_TONE.negative },
  { key: 'pending', label: 'decisionPending', tone: BADGE_TONE.pending },
] as const satisfies readonly { key: DecisionStatusT; label: string; tone: string }[]

type DecisionProgressBadgePropsT = Record<DecisionStatusT, number> & {
  // Given only where the badge filters a list; elsewhere it is a plain readout.
  hidden?: ReadonlySet<DecisionStatusT>
  onToggle?: (status: DecisionStatusT) => void
}

export function DecisionProgressBadge({
  hidden,
  onToggle,
  ...counts
}: DecisionProgressBadgePropsT) {
  const { t } = useTranslation('common')
  return (
    <span className="flex flex-wrap gap-1">
      {PARTS.filter(({ key }) => counts[key] > 0).map(({ key, label, tone }) => {
        const className = cn(BADGE_BASE, tone, 'w-fit tabular-nums whitespace-nowrap')
        const text = `${t(label)} ${counts[key]}`
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
