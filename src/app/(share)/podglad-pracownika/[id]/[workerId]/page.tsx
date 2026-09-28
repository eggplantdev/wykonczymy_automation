import { notFound } from 'next/navigation'
import { requireInvestmentOr404 } from '@/lib/queries/investments'
import { getWorkerKosztorysPreview } from '@/lib/queries/worker-kosztorys'
import { WorkerKosztorysPage } from '@/components/kosztorys/worker-view/worker-kosztorys-page'

// „Podgląd" for one worker, under the bare (share) layout so it is the link's exact twin. That layout
// reads no session, so the guard lives here, as on /podglad-inwestora.
export default async function WorkerPreviewPage({
  params,
}: {
  params: Promise<{ id: string; workerId: string }>
}) {
  const { id, workerId: rawWorkerId } = await params
  const workerId = Number(rawWorkerId)
  if (!Number.isInteger(workerId) || workerId <= 0) notFound()

  const { investmentId } = await requireInvestmentOr404(id)
  const data = await getWorkerKosztorysPreview(investmentId, workerId)
  if (!data) notFound()

  return <WorkerKosztorysPage data={data} />
}
