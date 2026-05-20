import { notFound } from 'next/navigation'
import { getInvestment } from '@/lib/queries/investments'
import { KosztorysSpike } from '../kosztorys-spike-client'

export default async function KosztorysSpikePage({
  params,
}: {
  params: Promise<{ investmentId: string }>
}) {
  const { investmentId } = await params
  const id = Number(investmentId)
  if (!Number.isFinite(id) || id <= 0) notFound()

  const investment = await getInvestment(investmentId)
  if (!investment) notFound()

  return <KosztorysSpike investmentId={id} investmentName={investment.name} />
}
