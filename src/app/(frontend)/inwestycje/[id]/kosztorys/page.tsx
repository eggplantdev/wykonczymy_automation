import { getPayload } from 'payload'
import config from '@payload-config'
import { parseInvestmentId } from '@/lib/queries/investment-id'
import { requireInvestmentOr404 } from '@/lib/queries/investments'
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
  // The sheet lookup keys off the parsed id, not off the guard's result, so it has no reason to wait
  // for it. Unlike the kosztorys_v2 fan-out it carries no access-control throw of its own, so it
  // cannot turn a logged-out session's login page into an error screen; only a dead DB could, and
  // then the page has no answer either way.
  const investmentId = parseInvestmentId(id)
  // Sheet id lives on the kosztoryses collection, not on investments.
  const sheetIdPromise = getPayload({ config }).then((payload) =>
    getInvestmentSheetId(payload, investmentId),
  )
  const [{ investment, trashed }, sheetId] = await Promise.all([
    requireInvestmentOr404(id, { allowTrashed: true }),
    sheetIdPromise,
  ])

  if (sheetId) {
    return (
      <SheetIframeView
        sheetId={sheetId}
        investmentName={investment.name}
        // Sync writes the transfers into the sheet; a trashed investment is read-only.
        toolbar={trashed ? undefined : <SyncButton investmentId={investmentId} />}
      />
    )
  }

  // Reached without a linked sheet: offer the same setup entry point as the listing.
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <p className="text-muted-foreground text-sm">
        Inwestycja <strong>{investment.name}</strong> nie ma jeszcze arkusza.
      </p>
      {!trashed && <SheetButton investmentId={investmentId} hasSheet={false} />}
    </div>
  )
}
