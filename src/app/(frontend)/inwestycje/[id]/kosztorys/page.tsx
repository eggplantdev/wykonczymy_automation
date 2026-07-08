import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getInvestment } from '@/lib/queries/investments'
import { getKosztorysTree } from '@/lib/queries/kosztorys'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { SheetIframeView } from '@/components/sheets/iframe-view'
import { SyncButton } from '@/components/sheets/sync-button'
import { KosztorysEditorV2 } from '@/components/kosztorys/kosztorys-editor-v2'
import { KosztorysTabHost } from '@/components/kosztorys/kosztorys-tab-host'

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

  // Sheet id lives on the kosztoryses collection now, not on investments.
  const payload = await getPayload({ config })
  const [sheetId, tree] = await Promise.all([
    getInvestmentSheetId(payload, investmentId),
    getKosztorysTree(investmentId),
  ])

  // Reached without a linked sheet (e.g. navigated here by accident): offer the
  // same setup entry point as the listing / investment view instead of a blank.
  const sheetPanel = sheetId ? (
    <SheetIframeView
      sheetId={sheetId}
      investmentName={investment.name}
      toolbar={<SyncButton investmentId={investmentId} />}
    />
  ) : (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        Inwestycja <strong>{investment.name}</strong> nie ma jeszcze arkusza.
      </p>
      <SheetButton investmentId={investmentId} investmentName={investment.name} hasSheet={false} />
    </div>
  )

  return (
    <KosztorysTabHost
      editor={
        <KosztorysEditorV2
          investmentId={investmentId}
          tree={tree}
          investmentName={investment.name}
        />
      }
      sheet={sheetPanel}
    />
  )
}
