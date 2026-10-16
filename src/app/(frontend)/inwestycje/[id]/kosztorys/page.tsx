import { notFound } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@payload-config'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { fetchReferenceData, findInvestmentRef } from '@/lib/queries/reference-data'
import { requireManagementPage } from '@/lib/auth/require-management-page'
import { getInvestmentSheetId } from '@/lib/google/sheet-lookup'
import { SheetButton } from '@/components/dialogs/sheet-button'
import { SheetIframeView } from '@/components/sheets/iframe-view'
import { SyncButton } from '@/components/sheets/sync-button'

export default async function InvestmentKosztorysPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const investmentId = parseInvestmentId(id)
  const sheetIdPromise = getPayload({ config }).then((payload) =>
    getInvestmentSheetId(payload, investmentId),
  )
  const [refData, sheetId] = await Promise.all([
    requireManagementPage().then(() => fetchReferenceData()),
    sheetIdPromise,
  ])
  const found = findInvestmentRef(refData, investmentId)
  if (!found) notFound()
  const { investment, trashed } = found

  if (sheetId) {
    return (
      <SheetIframeView
        sheetId={sheetId}
        investmentName={investment.name}
        toolbar={trashed ? undefined : <SyncButton investmentId={investmentId} />}
      />
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        Inwestycja <strong>{investment.name}</strong> nie ma jeszcze arkusza.
      </p>
      {!trashed && <SheetButton investmentId={investmentId} hasSheet={false} />}
    </div>
  )
}
