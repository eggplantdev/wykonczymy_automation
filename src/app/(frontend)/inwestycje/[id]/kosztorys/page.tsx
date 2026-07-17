import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestment } from '@/lib/queries/investments'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { SheetIframeView } from '@/components/sheets/iframe-view'
import { SyncButton } from '@/components/sheets/sync-button'

// The legacy Google Sheet ("arkusz") view. The in-app editor lives at its own
// /kosztorys_v2 route now — this page is sheet-only.
export default async function InvestmentKosztorysPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) redirect('/')

  const investment = await getInvestment(id)
  if (!investment) notFound()

  // Sheet id lives on the kosztoryses collection, not on investments.
  const payload = await getPayload({ config })
  const sheetId = await getInvestmentSheetId(payload, investmentId)

  if (sheetId) {
    return (
      <SheetIframeView
        sheetId={sheetId}
        investmentName={investment.name}
        toolbar={<SyncButton investmentId={investmentId} />}
      />
    )
  }

  // Reached without a linked sheet: offer the same setup entry point as the listing.
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        Inwestycja <strong>{investment.name}</strong> nie ma jeszcze arkusza.
      </p>
      <SheetButton investmentId={investmentId} hasSheet={false} />
    </div>
  )
}
