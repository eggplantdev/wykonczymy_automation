'use client'

import { badgeVariants, type BadgeToneT } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

export type DecisionStatusT = 'accepted' | 'rejected' | 'pending'

const PARTS = [
  { key: 'accepted', label: 'decisionAccepted', tone: 'positive' },
  { key: 'rejected', label: 'decisionRejected', tone: 'negative' },
  { key: 'pending', label: 'decisionPending', tone: 'pending' },
] as const satisfies readonly { key: DecisionStatusT; label: string; tone: BadgeToneT }[]

type DecisionProgressBadgePropsT = Record<DecisionStatusT, number> & {
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
        const className = cn(badgeVariants({ tone }), 'w-fit tabular-nums')
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
