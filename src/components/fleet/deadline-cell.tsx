'use client'

import { daysLabel } from '@/lib/utils/deadline-label'
import { OVERDUE } from '@/lib/fleet/thresholds'
import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'
import type { FleetDeadlineT } from '@/types/fleet'

type DeadlineCellPropsT = {
  deadline: FleetDeadlineT
  /** A retired car carries no urgency — its deadlines are history, not a to-do list. */
  muted?: boolean
}

/**
 * Four visually distinct states, not two: overdue/urgent, fine, **no data at all**, and „does not
 * apply". "Nothing recorded" must never look like "nothing due" — that is the blind spot the whole
 * reminder module exists to close — and an exempt type must not look like either, or the one car
 * that legitimately has no termin would sit in the listing as a permanent false alarm.
 *
 * Exempt wins over everything below it: an old event on a type the car has since been excused from
 * would otherwise resurrect a deadline the owner has already answered.
 */
export function DeadlineCell({ deadline, muted }: DeadlineCellPropsT) {
  if (deadline.exempt) {
    return <span className="text-muted-foreground text-xs">bezterminowo</span>
  }

  if (!deadline.hasEvent) {
    return <span className="text-muted-foreground text-xs">brak danych</span>
  }

  if (!deadline.nextDueAt || deadline.daysLeft === null) {
    return <span className="text-muted-foreground text-xs">bez terminu</span>
  }

  const urgent = !muted && deadline.bucket === OVERDUE
  const warning = !muted && deadline.bucket !== null && deadline.bucket !== OVERDUE

  return (
    <div className="flex flex-col leading-tight">
      <span
        className={cn(
          'text-sm',
          urgent && 'text-destructive font-medium',
          warning && 'text-chart-orange font-medium',
          muted && 'text-muted-foreground',
        )}
      >
        {formatPLDate(deadline.nextDueAt)}
      </span>
      <span className={cn('text-xs', urgent ? 'text-destructive' : 'text-muted-foreground')}>
        {daysLabel(deadline.daysLeft)}
      </span>
    </div>
  )
}
