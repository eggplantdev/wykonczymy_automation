'use client'

import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { SubcontractorHeadlineSummary } from '@/components/kosztorys/summary/blocks/subcontractor-headline-summary'
import { SubcontractorStageBreakdown } from '@/components/kosztorys/summary/blocks/subcontractor-stage-breakdown'
import { SubcontractorWorkerTotals } from '@/components/kosztorys/summary/blocks/subcontractor-worker-totals'
import { SubcontractorPayoutsTable } from '@/components/kosztorys/summary/tables/subcontractor-payouts-table'
import { EditorGlobalSettings } from '@/components/kosztorys/editor/toolbar/editor-global-settings'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import { derivePayoutsByWorker } from '@/lib/kosztorys/payouts-by-worker'
import { subcontractorStageBreakdown } from '@/lib/kosztorys/subcontractor-stage-breakdown'
import type { SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { WorkerRefT } from '@/types/reference-data'
import type { PayoutTransactionRowT } from '@/types/transfers'

type PropsT = {
  investmentId: number
  // View-independent settlement: each etap valued at its OWN plane's price. `combined` is „Suma
  // wykonanej pracy"; `wTools`/`ownTools` feed the split rows; `hasUnconfirmedPlane` flips the badge.
  subcontractorDue: SubcontractorDueByPlaneT
  // The PAYOUT rows, already date-desc from the query. Both the sortable list and the per-worker Σ
  // come off these — a host cannot hand in a total that disagrees with the rows beneath it.
  payoutTransactions: PayoutTransactionRowT[]
  // The etap list and the roster: stages say who is ASSIGNED
  // (even where nothing is owed yet), workers supply names the payout rows don't carry.
  stages?: KosztorysStageT[]
  workers?: WorkerRefT[]
  // Off on a host outside KosztorysEditorProvider (the investment page) — the coefficient controls
  // read the editor context, which only exists inside the editor.
  showGlobalSettings?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table). One signal, not two: the host that drops the lists is the compact host, so the
  // per-plane split rows and the per-worker and per-etap tables go with them, leaving the three totals
  // that matter.
  showTransactions?: boolean
}

// The subcontractor-plane footer, shown in the Z narzędziami / Bez narzędzi views in place of the
// client Podsumowanie.
export function SubcontractorSummary({
  investmentId,
  subcontractorDue,
  payoutTransactions,
  stages,
  workers,
  showGlobalSettings = true,
  showTransactions = true,
}: PropsT) {
  const payouts = derivePayoutsByWorker(payoutTransactions, workers ?? [])
  const summary = computeSubcontractorSummary(subcontractorDue.combined, payouts, {
    byWorker: subcontractorDue.byWorker,
    stages,
    workers,
  })
  const breakdown = subcontractorStageBreakdown(subcontractorDue, stages ?? [], summary.rows)
  // A premia is an entitlement, not cash out — it reads in the totals above, never as a wypłata.
  const cashPayouts = payoutTransactions.filter((tx) => tx.type === 'PAYOUT')

  return (
    <div className="text-foreground flex w-full flex-col gap-y-4 px-4 pt-4 pb-4 text-sm">
      {/* The multiplier controls lead the block, like the rozliczenie selects on the other tabs: they
          price every figure below them, so they read as the setting the tables answer to rather than
          a footnote to one of them. Above the row, not inside its left column — nested there they
          pushed the headline table down and the two tables stopped lining up. */}
      {showGlobalSettings && <EditorGlobalSettings />}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        {showTransactions && summary.rows.length > 0 && (
          <SubcontractorWorkerTotals investmentId={investmentId} rows={summary.rows} />
        )}
        <SubcontractorHeadlineSummary
          summary={summary}
          due={subcontractorDue}
          showPlanes={showTransactions}
        />
      </div>

      {showTransactions && breakdown.rows.length > 0 && (
        <SubcontractorStageBreakdown breakdown={breakdown} />
      )}

      {showTransactions && cashPayouts.length > 0 && (
        <CollapsibleSection title="Lista wpłat" size="sm" defaultOpen={false}>
          <SubcontractorPayoutsTable
            investmentId={investmentId}
            payouts={payouts}
            payoutTransactions={cashPayouts}
          />
        </CollapsibleSection>
      )}
    </div>
  )
}
