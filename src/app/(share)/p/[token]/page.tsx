import { notFound } from 'next/navigation'
import { getWorkerKosztorysByToken } from '@/lib/queries/worker-kosztorys'
import { WorkerKosztorysPage } from '@/components/kosztorys/worker-view/worker-kosztorys-page'

// The worker's public entrance. Like /k/<token>, a revoked and a never-issued token share one 404.
export default async function WorkerSharedKosztorysPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const data = await getWorkerKosztorysByToken(token)
  if (!data) notFound()

  return <WorkerKosztorysPage data={data} />
}
