'use client'

import { cn } from '@/lib/utils/cn'
import { effectiveMaterialsNetRate, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { computeAmountDue, type MaterialsT } from '@/lib/kosztorys/summary-economics'
import { sumDeposits } from '@/lib/kosztorys/deposit-planes'
import { depositsStrandedBy } from '@/lib/kosztorys/off-plane-deposits'
import { settlementModeDepositImpact } from '@/lib/kosztorys/investor-impact'
import { toSettlement, type SubcontractorDueByPlaneT } from '@/lib/kosztorys/subcontractor-due'
import { SummaryStagesTab } from '@/components/kosztorys/summary/tabs/summary-stages-tab'
import { SummaryOverviewTab } from '@/components/kosztorys/summary/tabs/summary-overview-tab'
import { SummaryExpensesTab } from '@/components/kosztorys/summary/tabs/summary-expenses-tab'
import { SubcontractorSummary } from '@/components/kosztorys/summary/blocks/subcontractor-summary'
import { SummaryMarginTab } from '@/components/kosztorys/summary/tabs/summary-margin-tab'
import { SummaryInvestmentTab } from '@/components/kosztorys/summary/tabs/summary-investment-tab'
import {
  ALL_SUMMARY_VIEWS,
  allowedSummaryViews,
  type SummaryViewT,
} from '@/components/kosztorys/summary/model/summary-views'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { SummaryInvestmentSettings } from '@/components/kosztorys/summary/settings/summary-investment-settings'
import { MATERIALS_GROSS_LOCK_REASON } from '@/components/kosztorys/summary/model/materials-pricing-options'
import { useSummaryView } from '@/components/kosztorys/summary/hooks/use-summary-view'
import type { InvestmentFinancialsT, MaterialsBreakdownRowT } from '@/types/investment-financials'
import { type KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { InvestmentWithDetailsT, WorkerRefT } from '@/types/reference-data'
import type { MediaFileT } from '@/types/media'
import type {
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

type HostLayoutT = {
  views: SummaryViewT[]
  // Reads the editor context, so only the editor host, which sits
  // inside KosztorysEditorProvider, may turn it on.
  settingsBar: boolean
  transactionLists: boolean
  pies: boolean
  gutter?: string
}

type SummaryHostT = 'editor' | 'investment'

const HOST_LAYOUT: Record<SummaryHostT, HostLayoutT> = {
  editor: {
    views: ALL_SUMMARY_VIEWS,
    settingsBar: true,
    transactionLists: true,
    pies: true,
    gutter: 'px-4',
  },
  investment: {
    views: ['summary', 'expenses', 'margin'],
    settingsBar: false,
    transactionLists: false,
    pies: false,
  },
}

type PropsT = {
  investmentId: number
  investmentName: string
  depositTransactions: DepositTransactionRowT[]
  // Robocizna wartość netto — executed total AFTER rabat
  laborCostsNet: number
  materialsGrossBase: number
  materialsNetBilled: number
  materialsBreakdown: MaterialsBreakdownRowT[]
  settledBreakdown?: MaterialsBreakdownRowT[]
  discountAmount: number
  lossAmount: number
  reconciliation: KosztorysReconciliationT
  vatRate: number
  settlementMode: SettlementModeT
  onSettlementModeChange?: (mode: SettlementModeT, depositImpact?: string) => void
  // The investment's persisted materiały netto rate as a fraction; null = the concession is off.
  materialsNetRate: number | null
  onMaterialsNetRateChange?: (rate: number | null) => void
  isSavingSettings?: boolean
  host: SummaryHostT
  preview?: boolean
  stages?: KosztorysStageT[]
  stageTotals?: Map<number, number>
  workers?: WorkerRefT[]
  payoutTransactions?: PayoutTransactionRowT[]
  materialTransactions?: MaterialTransactionRowT[]
  subcontractorDue?: SubcontractorDueByPlaneT
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals)
  totalNet?: number
  sectionSubtotals?: SectionSliceInputT[]
  marginForecastByPlane?: Record<ToolPlaneT, MarginForecastT>
  // Absent only where the reader's ROLE
  // says so (a MANAGER gets no marża); the client share passes it like every other host, and the
  // tab is kept off the client by `preview` below
  financials?: InvestmentFinancialsT
  investment?: InvestmentWithDetailsT
  assets?: MediaFileT[]
}

export function SummaryPanelContent({
  investmentId,
  investmentName,
  depositTransactions,
  laborCostsNet,
  materialsGrossBase,
  materialsNetBilled,
  materialsBreakdown,
  settledBreakdown,
  discountAmount,
  lossAmount,
  reconciliation,
  vatRate,
  settlementMode,
  onSettlementModeChange,
  materialsNetRate,
  onMaterialsNetRateChange,
  isSavingSettings = false,
  host,
  preview = false,
  stages,
  stageTotals,
  workers,
  payoutTransactions,
  materialTransactions,
  subcontractorDue,
  totalNet,
  sectionSubtotals,
  marginForecastByPlane,
  financials,
  investment,
  assets,
}: PropsT) {
  const [summaryView, setSummaryView] = useSummaryView(preview)
  // This component reads no session on purpose: it also renders under (share), which mounts no
  // CurrentUserProvider
  const layout = HOST_LAYOUT[host]
  const viewOptions = allowedSummaryViews(layout.views, {
    preview,
    hasMarginInputs: financials !== undefined && subcontractorDue !== undefined,
    hasInvestmentInfo: investment !== undefined,
  })
  const view: SummaryViewT = viewOptions.some((option) => option.value === summaryView)
    ? summaryView
    : (viewOptions[0]?.value ?? 'summary')
  const paidPair = sumDeposits(depositTransactions)
  const changeSettlementMode =
    onSettlementModeChange &&
    ((mode: SettlementModeT) =>
      onSettlementModeChange(
        mode,
        settlementModeDepositImpact(depositsStrandedBy(depositTransactions, mode)),
      ))
  const effectiveNetRate = effectiveMaterialsNetRate(settlementMode, materialsNetRate)
  const pricingLockedReason = settlementMode === 'GROSS' ? MATERIALS_GROSS_LOCK_REASON : undefined
  const materials: MaterialsT = { grossBase: materialsGrossBase, netBilled: materialsNetBilled }
  const amountDue = computeAmountDue(
    laborCostsNet,
    paidPair,
    materials,
    vatRate,
    effectiveNetRate,
    lossAmount,
  )
  return (
    <>
      <div
        className={cn('flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pt-4', layout.gutter)}
      >
        <ToggleGroup
          options={viewOptions}
          value={view}
          onChange={setSummaryView}
          aria-label="Widok podsumowania"
        />
        {!preview && changeSettlementMode && onMaterialsNetRateChange && (
          <SummaryInvestmentSettings
            vatRate={vatRate}
            settlementMode={settlementMode}
            onSettlementModeChange={changeSettlementMode}
            materialsNetRate={effectiveNetRate}
            onMaterialsNetRateChange={onMaterialsNetRateChange}
            pricingLockedReason={pricingLockedReason}
            isSaving={isSavingSettings}
            showSettingsBar={layout.settingsBar}
          />
        )}
      </div>
      <SummaryScrollRegion>
        {view === 'subcontractors' && subcontractorDue ? (
          <SubcontractorSummary
            investmentId={investmentId}
            investmentName={investmentName}
            subcontractorDue={subcontractorDue}
            payoutTransactions={payoutTransactions ?? []}
            stages={stages}
            workers={workers}
            showGlobalSettings={layout.settingsBar}
            showTransactions={layout.transactionLists}
          />
        ) : (
          <div className={cn('flex w-full flex-col gap-y-4 pt-4 pb-4', layout.gutter)}>
            {view === 'summary' && (
              <SummaryOverviewTab
                investmentId={investmentId}
                settlementMode={settlementMode}
                onSettlementModeChange={preview ? undefined : changeSettlementMode}
                isSavingSettings={isSavingSettings}
                laborCostsNet={laborCostsNet}
                amountDue={amountDue}
                materials={materials}
                discountAmount={discountAmount}
                lossAmount={lossAmount}
                reconciliation={reconciliation}
                priceView="client"
                vatRate={vatRate}
                materialsNetRate={effectiveNetRate}
                paidPair={paidPair}
                depositRows={depositTransactions}
                showDeposits={layout.transactionLists}
                preview={preview}
                showPie={layout.pies}
              />
            )}
            {view === 'expenses' && (
              <SummaryExpensesTab
                investmentId={investmentId}
                investmentName={investmentName}
                materialsBreakdown={materialsBreakdown}
                // marża-side spend must fail closed on every path into a client render.
                settledBreakdown={preview ? undefined : settledBreakdown}
                materialTransactions={materialTransactions ?? []}
                materialsNetRate={effectiveNetRate}
                vatRate={vatRate}
                onMaterialsNetRateChange={preview ? undefined : onMaterialsNetRateChange}
                isSavingSettings={isSavingSettings}
                pricingLockedReason={pricingLockedReason}
                preview={preview}
                showTransactions={layout.transactionLists}
              />
            )}

            {view === 'stages' && stages && stageTotals && (
              <SummaryStagesTab
                stages={stages}
                stageTotals={stageTotals}
                executedNet={totalNet ?? 0}
                sectionSubtotals={sectionSubtotals ?? []}
                vatRate={vatRate}
                preview={preview}
              />
            )}
            {view === 'margin' && financials && subcontractorDue && (
              <SummaryMarginTab
                financials={financials}
                laborCostsNet={laborCostsNet}
                discountAmount={discountAmount}
                subcontractor={toSettlement(subcontractorDue)}
                forecastByPlane={marginForecastByPlane}
              />
            )}
            {view === 'investment' && investment && (
              <SummaryInvestmentTab investment={investment} assets={assets} />
            )}
          </div>
        )}
      </SummaryScrollRegion>
    </>
  )
}
