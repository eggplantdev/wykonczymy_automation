import { BADGE_BASE, BADGE_TONE } from '@/components/ui/badge'
import { useTranslation } from '@/hooks/use-translation'
import {
  REPORT_STATUS_LABEL_KEYS,
  type ReportStatusT,
} from '@/lib/kosztorys/worker-report/report-status'
import { cn } from '@/lib/utils/cn'

type PropsT = { status: ReportStatusT; lineCount: number; acceptedLineCount: number }

export function WorkerReportStatusBadge({ status, lineCount, acceptedLineCount }: PropsT) {
  const { t } = useTranslation('workerReports')
  if (status === 'pending') {
    return (
      <span className={cn(BADGE_BASE, BADGE_TONE.pending)}>
        {t(REPORT_STATUS_LABEL_KEYS.pending)}
      </span>
    )
  }
  if (status === 'rejected') {
    return (
      <span className={cn(BADGE_BASE, BADGE_TONE.muted)}>
        {t(REPORT_STATUS_LABEL_KEYS.rejected)}
      </span>
    )
  }
  return (
    <span className={cn(BADGE_BASE, BADGE_TONE.positive)}>
      {acceptedLineCount === lineCount
        ? t(REPORT_STATUS_LABEL_KEYS.accepted)
        : t('acceptedPartial', { accepted: acceptedLineCount, total: lineCount })}
    </span>
  )
}
