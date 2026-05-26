import { notFound } from 'next/navigation'
import { getInvestment } from '@/lib/queries/investments'
import { KosztorysIframeView } from './iframe-view'
import { SyncButton } from './sync-button'

export default async function KosztorysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  // No body when the sheet isn't linked — the layout-level banner (Task 9) is
  // the whole story for this state, doubling it would be noise.
  if (!investment.googleSheetId) return null

  return (
    <KosztorysIframeView
      sheetId={investment.googleSheetId}
      investmentName={investment.name}
      investmentId={investmentId}
      toolbar={<SyncButton investmentId={investmentId} />}
    />
  )
}
