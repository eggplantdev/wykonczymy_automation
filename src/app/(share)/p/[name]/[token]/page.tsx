import { notFound } from 'next/navigation'
import { getWorkerKosztorysByToken } from '@/lib/queries/worker-kosztorys'
import { WorkerKosztorysPage } from '@/components/kosztorys/worker-view/worker-kosztorys-page'

// The worker's public entrance. Like /k/<token>, a revoked and a never-issued token share one 404.
// The name segment is not read: the token alone resolves, so a renamed worker's link keeps working.
export default async function WorkerSharedKosztorysPage({
  params,
}: {
  params: Promise<{ name: string; token: string }>
}) {
  const { token } = await params
  const data = await getWorkerKosztorysByToken(token)
  if (!data) notFound()

  return <WorkerKosztorysPage data={data} />
}
