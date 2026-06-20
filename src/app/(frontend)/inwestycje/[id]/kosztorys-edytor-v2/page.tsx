import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestment } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'

export default async function KosztorysEditorV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  const tree = await getKosztorysTree(investmentId)

  return (
    <KosztorysEditorV2 investmentId={investmentId} tree={tree} investmentName={investment.name} />
  )
}
