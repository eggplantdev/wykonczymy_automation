'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { WorkerReportReview } from '@/components/kosztorys/editor/dialogs/worker-reports/worker-report-review'
import { WorkerReportsList } from '@/components/kosztorys/editor/dialogs/worker-reports/worker-reports-list'
import type { WorkerReportsActionT } from '@/components/kosztorys/editor/actions/worker-reports-action'
import { useKosztorysEditorContext } from '@/components/kosztorys/editor/use-kosztorys-editor-context'
import type { WorkerReportSummaryT, WorkerReportT } from '@/lib/kosztorys/worker-report/types'
import { listInvestmentReports, readInvestmentReport } from '@/lib/queries/worker-reports'
import { toastMessage } from '@/lib/utils/toast'

type PropsT = { action: WorkerReportsActionT }

const LOAD_FAILED = 'Nie udało się wczytać zgłoszeń'

export function WorkerReportsDialog({ action }: PropsT) {
  const { investmentId } = useKosztorysEditorContext()
  return (
    <Dialog open={action.open} onOpenChange={action.setOpen}>
      <DialogContent className="sm:max-w-dialog-xl">
        <DialogHeader
          title="Zgłoszenia prac"
          description="Pracownicy zgłaszają wykonane ilości ze swojego linku. Zaznacz, co przyjmujesz — trafi do rozpiski."
        />
        {/* Mounted only while open, so every open rereads what the workers sent. */}
        {action.open && (
          <WorkerReportsBody
            investmentId={investmentId}
            initialReportId={action.reportId}
            onPendingCount={action.setPendingCount}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

type BodyPropsT = {
  investmentId: number
  initialReportId: number | undefined
  onPendingCount: (count: number) => void
}

function WorkerReportsBody({ investmentId, initialReportId, onPendingCount }: BodyPropsT) {
  const [reports, setReports] = useState<WorkerReportSummaryT[] | undefined>()
  const [openReport, setOpenReport] = useState<WorkerReportT | undefined>()
  const [listVersion, setListVersion] = useState(0)

  // Every list read also corrects the toolbar count — a decision here, or another window's.
  useEffect(() => {
    let active = true
    listInvestmentReports(investmentId)
      .then((next) => {
        if (!active) return
        setReports(next)
        onPendingCount(next.filter((report) => report.status === 'pending').length)
      })
      .catch(() => {
        if (!active) return
        toastMessage(LOAD_FAILED, 'error', 4000)
        setReports([])
      })
    return () => {
      active = false
    }
  }, [investmentId, listVersion, onPendingCount])

  const open = (reportId: number) => {
    readInvestmentReport(investmentId, reportId)
      .then((report) => {
        if (report) setOpenReport(report)
        else toastMessage('Tego zgłoszenia już nie ma', 'error', 4000)
      })
      .catch(() => toastMessage(LOAD_FAILED, 'error', 4000))
  }

  useEffect(() => {
    if (initialReportId !== undefined) open(initialReportId)
    // Once per mount: the deep-linked report opens with the dialog, not on every list reload.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const backToList = () => {
    setOpenReport(undefined)
    setListVersion((version) => version + 1)
  }

  if (openReport) {
    return (
      <WorkerReportReview
        key={openReport.id}
        report={openReport}
        onBack={() => setOpenReport(undefined)}
        onDecided={backToList}
      />
    )
  }
  if (!reports) return <p className="text-muted-foreground py-8 text-sm">Wczytywanie…</p>
  return <WorkerReportsList reports={reports} onOpen={open} />
}
