import { Badge } from '@/components/ui/badge'
import {
  DecisionProgressBadge,
  SETTLED_DECISION_TONE,
} from '@/components/ui/decision-progress-badge'
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
  return <Badge tone={SETTLED_DECISION_TONE[status]}>{t(REPORT_STATUS_LABEL_KEYS[status])}</Badge>
}
