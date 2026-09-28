import { notFound } from 'next/navigation'
import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getWorkerKosztorysPreview } from '@/lib/queries/worker-kosztorys'
import { WorkerKosztorysPage } from '@/components/kosztorys/worker-view/worker-kosztorys-page'
import { workerIdFromSegment } from '@/lib/kosztorys/worker-view/name-slug'

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
  const data = await getWorkerKosztorysPreview(investmentId, workerId)
  if (!data) notFound()

  return <WorkerKosztorysPage data={data} />
}
