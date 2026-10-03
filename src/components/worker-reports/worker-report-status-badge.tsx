import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import type { ReportStatusT } from '@/lib/kosztorys/worker-report/types'
import { cn } from '@/lib/utils/cn'

type PropsT = { status: ReportStatusT; lineCount: number; acceptedLineCount: number }

const PENDING_TONE = 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'

export function WorkerReportStatusBadge({ status, lineCount, acceptedLineCount }: PropsT) {
  if (status === 'pending') {
    return <span className={cn(BADGE_BASE, PENDING_TONE)}>Do sprawdzenia</span>
  }
  if (status === 'rejected') {
    return <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>Odrzucone</span>
  }
  return (
    <span className={cn(BADGE_BASE, BADGE_TONE.positive)}>
      {acceptedLineCount === lineCount
        ? 'Przyjęte'
        : `Przyjęte ${acceptedLineCount} z ${lineCount}`}
    </span>
  )
}
