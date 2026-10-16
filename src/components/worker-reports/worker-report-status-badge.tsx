import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { useTranslation } from '@/hooks/use-translation'
import {
  REPORT_STATUS_LABEL_KEYS,
  type ReportStatusT,
} from '@/lib/kosztorys/worker-report/report-status'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  status: ReportStatusT
  lineCount: number
  acceptedLineCount: number
  rejectedLineCount: number
}

const STATUS_TONE: Record<ReportStatusT, string> = {
  pending: BADGE_TONE.pending,
  accepted: BADGE_TONE.positive,
  rejected: BADGE_TONE.muted,
}

export function WorkerReportStatusBadge({
  status,
  lineCount,
  acceptedLineCount,
  rejectedLineCount,
}: PropsT) {
  const { t } = useTranslation('workerReports')
  const pending = status === 'pending' ? lineCount - acceptedLineCount - rejectedLineCount : 0
  if (acceptedLineCount + rejectedLineCount + pending > 0) {
    return (
      <DecisionProgressBadge
        accepted={acceptedLineCount}
        rejected={rejectedLineCount}
        pending={pending}
      />
    )
  }
  return (
    <span className={cn(BADGE_BASE, STATUS_TONE[status])}>
      {t(REPORT_STATUS_LABEL_KEYS[status])}
    </span>
  )
}
