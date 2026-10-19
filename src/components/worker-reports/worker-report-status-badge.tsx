import { Badge, type BadgeToneT } from '@/components/ui/badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { useTranslation } from '@/hooks/use-translation'
import {
  REPORT_STATUS_LABEL_KEYS,
  type ReportStatusT,
} from '@/lib/kosztorys/worker-report/report-status'

type PropsT = {
  status: ReportStatusT
  lineCount: number
  acceptedLineCount: number
  rejectedLineCount: number
}

const STATUS_TONE: Record<ReportStatusT, BadgeToneT> = {
  pending: 'pending',
  accepted: 'positive',
  rejected: 'muted',
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
  return <Badge tone={STATUS_TONE[status]}>{t(REPORT_STATUS_LABEL_KEYS[status])}</Badge>
}
