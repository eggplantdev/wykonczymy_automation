'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
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
  // Decisions live only in the window until „Zapisz zmiany”, while a praca added to the rozpiska is
  // already there — a stray Esc would leave it an empty pozycja and the line back in „Spoza rozpiski”.
  const [hasEdits, setHasEdits] = useState(false)
  const [isConfirmingClose, setIsConfirmingClose] = useState(false)
  const close = () => {
    setHasEdits(false)
    action.setOpen(false)
  }
  return (
    <>
      <Dialog
        open={action.open}
        onOpenChange={(open) => {
          if (open) action.setOpen(true)
          else if (hasEdits) setIsConfirmingClose(true)
          else close()
        }}
      >
        <DialogContent className="sm:max-w-dialog-3xl sm:max-h-[95vh]">
          <DialogHeader title="Zgłoszenia prac" />
          {/* Mounted only while open, so every open rereads what the workers sent. */}
          {action.open && (
            <WorkerReportsBody
              investmentId={investmentId}
              initialReportId={action.reportId}
              onPendingCount={action.setPendingCount}
              onHasEdits={setHasEdits}
            />
          )}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={isConfirmingClose}
        title="Zamknąć bez zapisywania?"
        description="Zmiany w tym zgłoszeniu nie zostały zapisane i przepadną."
        confirmLabel="Zamknij bez zapisywania"
        cancelLabel="Wróć do zgłoszenia"
        onConfirm={close}
        onCancel={() => setIsConfirmingClose(false)}
      />
    </>
  )
}

type BodyPropsT = {
  investmentId: number
  initialReportId: number | undefined
  onPendingCount: (count: number) => void
  onHasEdits: (hasEdits: boolean) => void
}

function WorkerReportsBody({
  investmentId,
  initialReportId,
  onPendingCount,
  onHasEdits,
}: BodyPropsT) {
  const [reports, setReports] = useState<WorkerReportSummaryT[] | undefined>()
  const [openReport, setOpenReport] = useState<WorkerReportT | undefined>()
  const [listVersion, setListVersion] = useState(0)
  // Bumped by a save, so the review remounts on the saved report instead of keeping its drafts.
  const [reviewVersion, setReviewVersion] = useState(0)
  // Here rather than in the review, which a save remounts.
  const [isHidingVerified, setIsHidingVerified] = useState(false)

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

  const reloadReport = (reportId: number) => {
    onHasEdits(false)
    setListVersion((version) => version + 1)
    readInvestmentReport(investmentId, reportId)
      .then((report) => {
        setOpenReport(report)
        setReviewVersion((version) => version + 1)
      })
      .catch(() => {
        toastMessage(LOAD_FAILED, 'error', 4000)
        // Back to the list: the review still shows the report as it was before the save.
        setOpenReport(undefined)
      })
  }

  if (openReport) {
    return (
      <WorkerReportReview
        key={`${openReport.id}-${reviewVersion}`}
        report={openReport}
        onEdit={() => onHasEdits(true)}
        onDecided={() => reloadReport(openReport.id)}
        isHidingVerified={isHidingVerified}
        onHidingVerifiedChange={setIsHidingVerified}
      />
    )
  }
  if (!reports) return <p className="text-muted-foreground py-8 text-sm">Wczytywanie…</p>
  return <WorkerReportsList reports={reports} onOpen={open} />
}
