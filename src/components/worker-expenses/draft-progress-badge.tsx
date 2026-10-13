import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { DraftProgressT } from '@/lib/db/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'

const PARTS = [
  { key: 'accepted', label: 'Przyjęte', tone: BADGE_TONE.positive },
  { key: 'rejected', label: 'Odrzucone', tone: BADGE_TONE.negative },
  { key: 'pending', label: 'Do sprawdzenia', tone: BADGE_TONE.pending },
] as const

export function DraftProgressBadge({ progress }: { progress: DraftProgressT }) {
  return (
    <span className="flex flex-wrap gap-1">
      {PARTS.map(({ key, label, tone }) => (
        <span key={key} className={cn(BADGE_BASE, tone, 'w-fit tabular-nums')}>
          {label} {progress[key]}
        </span>
      ))}
    </span>
  )
}
