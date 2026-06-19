import { redirect, notFound } from 'next/navigation'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestment } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { KosztorysEditor } from '@/components/kosztorys/kosztorys-editor'
import { PageWrapper } from '@/components/ui/page-wrapper'

export default async function KosztorysEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/zaloguj')

  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  const tree = await getKosztorysTree(investmentId)

  return (
    <PageWrapper title={`Kosztorys — ${investment.name}`}>
      <KosztorysEditor investmentId={investmentId} tree={tree} />
    </PageWrapper>
  )
}
