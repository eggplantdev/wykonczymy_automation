'use client'

import { Badge, BadgeButton, type BadgeToneT } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/use-translation'
import { cn } from '@/lib/utils/cn'

export type DecisionStatusT = 'accepted' | 'rejected' | 'pending'

export const DECISION_TONE = {
  accepted: 'positive',
  rejected: 'negative',
  pending: 'pending',
} as const satisfies Record<DecisionStatusT, BadgeToneT>

const PARTS = [
  { key: 'accepted', label: 'decisionAccepted' },
  { key: 'rejected', label: 'decisionRejected' },
  { key: 'pending', label: 'decisionPending' },
] as const satisfies readonly { key: DecisionStatusT; label: string }[]

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
      {PARTS.filter(({ key }) => counts[key] > 0).map(({ key, label }) => {
        const tone = DECISION_TONE[key]
        const text = `${t(label)} ${counts[key]}`
        return onToggle ? (
          <BadgeButton
            key={key}
            tone={tone}
            aria-pressed={!hidden?.has(key)}
            className={cn('w-fit tabular-nums', hidden?.has(key) && 'line-through opacity-40')}
            onClick={() => onToggle(key)}
          >
            {text}
          </BadgeButton>
        ) : (
          <Badge key={key} tone={tone} className="w-fit tabular-nums">
            {text}
          </Badge>
        )
      })}
    </span>
  )
}
