'use client'

import Link from 'next/link'
import { Eye, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { reportHref } from '@/lib/kosztorys/worker-report/report-param'

type PropsT = {
  report: ReportListRowT
  canOpenInKosztorys: boolean
  onPreview: (reportId: number) => void
  isLoading: boolean
  isDisabled: boolean
}

export function WorkerReportRowActions({
  report,
  canOpenInKosztorys,
  onPreview,
  isLoading,
  isDisabled,
}: PropsT) {
  const { t } = useTranslation('workerReports')
  return (
    <>
      <RowActionButton
        icon={isLoading ? Loader2 : Eye}
        className={isLoading ? '[&_svg]:animate-spin' : undefined}
        label={t('preview')}
        disabled={isDisabled}
        onClick={() => onPreview(report.id)}
      />
      {canOpenInKosztorys && (
        <Button asChild size="xs" variant="outline">
          <Link href={reportHref(report.investmentId, report.id)}>{t('openInKosztorys')}</Link>
        </Button>
      )}
    </>
  )
}
