import { notFound } from 'next/navigation'
import { getInvestment } from '@/lib/queries/investments'
import { KosztorysButton } from '@/components/dialogs/kosztorys-button'
import { KosztorysIframeView } from './iframe-view'
import { SyncButton } from './sync-button'

export default async function KosztorysPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  // Reached without a linked sheet (e.g. navigated here by accident): offer the
  // same setup entry point as the listing / investment view instead of a blank.
  if (!investment.googleSheetId) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Inwestycja <strong>{investment.name}</strong> nie ma jeszcze powiązanego kosztorysu.
        </p>
        <KosztorysButton
          investmentId={investmentId}
          investmentName={investment.name}
          hasSheet={false}
        />
      </div>
    )
  }

  return (
    <KosztorysIframeView
      sheetId={investment.googleSheetId}
      investmentName={investment.name}
      toolbar={<SyncButton investmentId={investmentId} />}
    />
  )
}
