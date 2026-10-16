'use client'

import { daysLabel } from '@/lib/utils/deadline-label'
import { OVERDUE } from '@/lib/fleet/thresholds'
import { formatPLDate } from '@/lib/utils/format-date'
import { cn } from '@/lib/utils/cn'
import type { FleetDeadlineT } from '@/types/fleet'

type DeadlineCellPropsT = {
  deadline: FleetDeadlineT
  muted?: boolean
}

/**
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
