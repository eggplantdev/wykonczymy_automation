import { notFound } from 'next/navigation'
import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getWorkerReportPreview } from '@/lib/queries/worker-report-page'
import { WorkerReportView } from '@/components/kosztorys/worker-report/worker-report-view'
import { REPORT_VIEWPORT } from '@/components/kosztorys/worker-report/report-viewport'
import { workerIdFromSegment } from '@/lib/kosztorys/worker-view/name-slug'

export const viewport = REPORT_VIEWPORT

// „Podgląd" for one worker, under the bare (share) layout so it is the link's exact twin. That layout
// reads no session, so the guard lives here, as on /podglad-inwestora.
export default async function WorkerPreviewPage({
  params,
}: {
  params: Promise<{ worker: string; id: string }>
}) {
  const { worker, id } = await params
  const workerId = workerIdFromSegment(worker)
  if (workerId === undefined) notFound()

  const { investmentId } = await requireInvestmentOr404(id)
  const page = await getWorkerReportPreview(investmentId, workerId)
  if (!page) notFound()

  return <WorkerReportView page={page} />
}
