'use client'

import { useState } from 'react'
import { ReportPreviewDialog } from '@/components/worker-reports/report-preview-dialog'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportPreviewT } from '@/lib/kosztorys/worker-report/types'
import { fetchReportPreview } from '@/lib/queries/report-preview'
import { toastMessage } from '@/lib/utils/toast'

export function useReportPreview() {
  const { t } = useTranslation('workerReports')
  const { t: tCommon } = useTranslation('common')
  const [loadingId, setLoadingId] = useState<number | undefined>()
  const [preview, setPreview] = useState<ReportPreviewT | undefined>()

  async function open(reportId: number) {
    setLoadingId(reportId)
    try {
      const next = await fetchReportPreview(reportId)
      if (next) setPreview(next)
      else toastMessage(t('notFound'), 'error')
    } catch {
      toastMessage(tCommon('genericError'), 'error')
    } finally {
      setLoadingId(undefined)
    }
  }

  const dialog = <ReportPreviewDialog preview={preview} onClose={() => setPreview(undefined)} />

  return { open, loadingId, dialog }
}
