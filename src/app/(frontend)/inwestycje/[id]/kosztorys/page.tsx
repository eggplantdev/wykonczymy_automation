import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { getInvestment } from '@/lib/queries/investments'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { SheetIframeView } from '@/components/sheets/iframe-view'
import { SyncButton } from '@/components/sheets/sync-button'

export default async function InvestmentSheetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const investmentId = Number(id)
  if (!Number.isFinite(investmentId) || investmentId <= 0) notFound()

  const investment = await getInvestment(id)
  if (!investment) notFound()

  // Sheet id lives on the kosztoryses collection now, not on investments.
  const payload = await getPayload({ config })
  const sheetId = await getInvestmentSheetId(payload, investmentId)

  // Reached without a linked sheet (e.g. navigated here by accident): offer the
  // same setup entry point as the listing / investment view instead of a blank.
  if (!sheetId) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <p className="text-muted-foreground text-sm">
          Inwestycja <strong>{investment.name}</strong> nie ma jeszcze kosztorysu.
        </p>
        <SheetButton
          investmentId={investmentId}
          investmentName={investment.name}
          hasSheet={false}
        />
      </div>
    )
  }

  return (
    <SheetIframeView
      sheetId={sheetId}
      investmentName={investment.name}
      toolbar={<SyncButton investmentId={investmentId} />}
    />
  )
}
