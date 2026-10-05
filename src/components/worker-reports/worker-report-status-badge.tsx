import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import {
  REPORT_STATUS_LABELS,
  type ReportStatusT,
} from '@/lib/kosztorys/worker-report/report-status'
import { cn } from '@/lib/utils/cn'

type PropsT = { status: ReportStatusT; lineCount: number; acceptedLineCount: number }

export function WorkerReportStatusBadge({ status, lineCount, acceptedLineCount }: PropsT) {
  if (status === 'pending') {
    return (
      <span className={cn(BADGE_BASE, BADGE_TONE.pending)}>{REPORT_STATUS_LABELS.pending}</span>
    )
  }
  if (status === 'rejected') {
    return <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>{REPORT_STATUS_LABELS.rejected}</span>
  }
  return (
    <span className={cn(BADGE_BASE, BADGE_TONE.positive)}>
      {acceptedLineCount === lineCount
        ? REPORT_STATUS_LABELS.accepted
        : `${REPORT_STATUS_LABELS.accepted} ${acceptedLineCount} z ${lineCount}`}
    </span>
  )
}
