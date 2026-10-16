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
  investmentName: string
  subcontractorDue: SubcontractorDueByPlaneT
  payoutTransactions: PayoutTransactionRowT[]
  stages?: KosztorysStageT[]
  workers?: WorkerRefT[]
  // Off on a host outside KosztorysEditorProvider (the investment page) — the coefficient controls
  // read the editor context, which only exists inside the editor.
  showGlobalSettings?: boolean
  showTransactions?: boolean
}

export function SubcontractorSummary({
  investmentId,
  investmentName,
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
  const cashPayouts = payoutTransactions.filter((tx) => tx.type === 'PAYOUT')

  return (
    <div className="text-foreground flex w-full flex-col gap-y-4 px-4 pt-4 pb-4 text-sm">
      {/* Above the row, not inside its left column — nested there they pushed the headline table
          down and the two tables stopped lining up. */}
      {showGlobalSettings && <EditorGlobalSettings />}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        {showTransactions && summary.rows.length > 0 && (
          <SubcontractorWorkerTotals
            investmentId={investmentId}
            investmentName={investmentName}
            rows={summary.rows}
          />
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
