'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScanReportDialog } from '@/components/worker-reports/scan-report-dialog'
import { useLatestRequest } from '@/hooks/use-latest-request'
import type { ScanWorkerT } from '@/lib/db/stage-memberships'
import { SCAN_REPORT_LABEL } from '@/lib/kosztorys/worker-report/constants'
import { reportHref } from '@/lib/kosztorys/worker-report/report-param'
import { readScanWorkers } from '@/lib/queries/worker-reports'
import { toastMessage } from '@/lib/utils/toast'

/** „Zgłoszenia prac" entry: the kierownik picks the worker and the investment, then lands in review. */
export function ScanReportButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [workers, setWorkers] = useState<ScanWorkerT[]>([])
  const workersRequest = useLatestRequest()

  function openDialog() {
    setOpen(true)
    const isCurrent = workersRequest.start()
    void readScanWorkers()
      .then((next) => {
        if (isCurrent()) setWorkers(next)
      })
      .catch(() => {
        if (isCurrent()) toastMessage('Nie udało się wczytać listy pracowników', 'error')
      })
  }

  return (
    <>
      <Button variant="ai" size="sm" onClick={openDialog}>
        <WandSparkles className="text-neon-cyan" />
        <span className="text-neon-cyan font-semibold">{SCAN_REPORT_LABEL}</span>
      </Button>
      <ScanReportDialog
        open={open}
        onOpenChange={setOpen}
        workers={workers}
        onCreated={(reportId, investmentId) => router.push(reportHref(investmentId, reportId))}
      />
    </>
  )
}
