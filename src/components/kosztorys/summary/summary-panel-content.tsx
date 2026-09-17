'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { effectiveMaterialsNetRate, type SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
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
import { allowedSummaryViews } from '@/components/kosztorys/summary/allowed-summary-views'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { SummaryInvestmentSettings } from '@/components/kosztorys/summary/summary-investment-settings'
import { MATERIALS_GROSS_LOCK_REASON } from '@/components/kosztorys/summary/materials-pricing-options'
import {
  useSummaryView,
  type SummaryViewT,
} from '@/components/kosztorys/summary/hooks/use-summary-view'
import type { InvestmentFinancialsT, MaterialsBreakdownRowT } from '@/types/investment-financials'
import { type KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT, ToolPlaneT } from '@/lib/kosztorys/types'
import type { MarginForecastT } from '@/lib/kosztorys/margin-forecast'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { WorkerRefT } from '@/types/reference-data'
import type {
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/transfers'

const SUMMARY_VIEW_OPTIONS: OptionT<SummaryViewT>[] = [
  { value: 'summary', label: 'Podsumowanie' },
  { value: 'expenses', label: 'Materiały' },
  { value: 'stages', label: 'Robocizna' },
  { value: 'subcontractors', label: 'Podwykonawcy' },
  { value: 'margin', label: 'Marża' },
]

const ALL_SUMMARY_VIEWS = SUMMARY_VIEW_OPTIONS.map((option) => option.value)

type PropsT = {
  investmentId: number
  // Only reaches the wydatki list, which names its invoice archive after the investment.
  investmentName: string
  // Individual deposit rows — the wpłaty list, the VAT-plane buckets every view's settlement reads,
  // AND the wpłaty total, which is summed from them rather than supplied beside them (EX-680).
  depositTransactions: DepositTransactionRowT[]
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNet: number
  // Materiały brutto — server sum of the investment's unsettled brutto-billed transactions.
  materialsGrossBase: number
  // Σ netAmount of the netto-billed wydatki — frozen: the netto pricing toggle must not touch it.
  materialsNetBilled: number
  // Per-expense-category split of both buckets (v1 parity); Σ === materiały billed total.
  materialsBreakdown: MaterialsBreakdownRowT[]
  // Company-plane material folded into robocizna, split per category — its own table in the wydatki
  // view. Omitted by the client share, which never builds it.
  settledBreakdown?: MaterialsBreakdownRowT[]
  discountAmount: number
  // Σ LOSS — the cost the company absorbed, deducted from the settlement at face value. Its own prop
  // rather than a field of `financials`, which is the marża gate: the client must see their debt come
  // down without seeing wypłaty or marża. Defaults to 0, so a host with no strata says nothing.
  lossAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (every host computes it unconditionally); preview suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  vatRate: number
  settlementMode: SettlementModeT
  // Optional because supplying them is what makes a host an *editor* of these settings. A host that
  // omits them renders the figures without the „Opcje rozliczenia" block — see the gate below.
  // The second argument is what the switch would strand — assembled here, where the wpłaty are, and
  // carried into the confirm dialog the writer raises.
  onSettlementModeChange?: (mode: SettlementModeT, depositImpact?: string) => void
  // The investment's persisted materiały netto rate as a fraction; null = the concession is off.
  // Server-owned on purpose — the panel and the marża the server computed read one value.
  materialsNetRate: number | null
  onMaterialsNetRateChange?: (rate: number | null) => void
  // A settings write is in flight. None of them is optimistic — the server recomputes every figure
  // they move — so the block is disabled until the fresh values arrive.
  isSavingSettings?: boolean
  // Which views this host offers, in toggle order. A host that omits a view need not supply the props
  // that only feed it — hence every prop below is optional.
  views?: SummaryViewT[]
  // Rendered in the pinned top bar beside the view toggle (the investment page's v1/v2 reading toggle).
  topBarSlot?: ReactNode
  // VAT + rabat globalny editing. Reads the editor context, so only a host inside
  // KosztorysEditorProvider may turn it on.
  showSettingsBar?: boolean
  // Off on a host that already lists every transaction next to the panel (the investment page's
  // transfers table): wydatki drops its materiały list, wpłaty keeps only the Razem buckets.
  showTransactionLists?: boolean
  // Off on a host where the panel is one block among several rather than a full-height overlay (the
  // investment page): the share pies are the first thing worth dropping when vertical space is tight.
  showPies?: boolean
  // On a host that already indents the page (the investment page), the panel's own side padding
  // lands ON TOP of the page gutter and the whole block sits a step right of everything around it.
  // The overlay host has no gutter of its own, so the padding stays on by default.
  flush?: boolean
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  preview?: boolean
  stages?: KosztorysStageT[]
  stageTotals?: Map<number, number>
  // Name lookup for a worker who holds etapy but has no wypłata yet (EX-613) — such a worker exists
  // only in the settlement's `byWorker`, which carries ids and no names.
  workers?: WorkerRefT[]
  // Individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  payoutTransactions?: PayoutTransactionRowT[]
  // Individual materiały rows — feed the wydatki tab's transaction list (data · typ · kwota).
  materialTransactions?: MaterialTransactionRowT[]
  // View-independent subcontractor settlement — each etap at its own plane's price, split + combined
  // + unconfirmed flag. The subcontractor block's headline figures. Ignored in the client view.
  subcontractorDue?: SubcontractorDueByPlaneT
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals); EtapTotals' readout.
  totalNet?: number
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals?: SectionSliceInputT[]
  // Both „Marża" scenarios, priced from the przedmiar by whichever host holds the rows. Absent on the
  // investment page, which renders the actual margin alone (it has no rows to price and no reason to
  // ship 1000 of them into the RSC payload for a figure read where the kosztorys is).
  marginForecastByPlane?: Record<ToolPlaneT, MarginForecastT>
  // Company-plane transfer aggregates — feeds the „Marża" tab. Absent only where the reader's ROLE
  // says so (a MANAGER gets no marża); the client share passes it like every other host, and the
  // tab is kept off the client by `preview` below, on the render side where every other client/owner
  // difference is decided.
  financials?: InvestmentFinancialsT
}

// Deliberately holds no shell: the editor wraps it in a bottom-anchored Collapsible overlay, the
// investment page in an ordinary section, and neither layout leaks in here.
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
  views = ALL_SUMMARY_VIEWS,
  topBarSlot,
  showSettingsBar = false,
  showTransactionLists = true,
  showPies = true,
  flush = false,
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
}: PropsT) {
  // Which view the panel shows — driven solely by the top toggle, fully independent of the grid's
  // price view (that only governs the grid columns now). „Podwykonawcy" is owner-only, so it drops out
  // of the client read-only toggle on top of whatever the host allowed. The persisted pick is shared
  // across hosts, so it can name a view this host doesn't offer — fall back to the first one it does,
  // rather than stranding the reader on a hidden view.
  const [summaryView, setSummaryView] = useSummaryView(preview)
  // This component reads no session on purpose: it also renders under (share), which mounts no
  // CurrentUserProvider — so who may see „Marża" arrives as `preview` plus the presence of
  // `financials`, both decided by the host.
  const allowedViews = allowedSummaryViews(views, {
    preview,
    hasMarginInputs: financials !== undefined && subcontractorDue !== undefined,
  })
  const viewOptions = SUMMARY_VIEW_OPTIONS.filter((option) => allowedViews.includes(option.value))
  const view: SummaryViewT = allowedViews.includes(summaryView)
    ? summaryView
    : (allowedViews[0] ?? 'summary')
  // The wpłaty on each plane, READ off the rows — a wpłata netto contributes nothing to brutto,
  // a wpłata brutto carries its own netto from the faktura. Summed here, beside the buckets, so the
  // settlement and the wpłaty list can never sum them by two rules.
  const paidPair = sumDeposits(depositTransactions, vatRate)
  // Both controls that write the tryb go through this, so neither can raise the switch without
  // pricing it first. Warning only — the switch is never refused (owner, 2026-08-23).
  const changeSettlementMode =
    onSettlementModeChange &&
    ((mode: SettlementModeT) =>
      onSettlementModeChange(
        mode,
        settlementModeDepositImpact(depositsStrandedBy(depositTransactions, mode)),
      ))
  // The same gate the server applies to `materialsNetDiscount`, so both sides fall silent together
  // rather than the panel discounting a figure marża never saw.
  const effectiveNetRate = effectiveMaterialsNetRate(settlementMode, materialsNetRate)
  // Derived once for both surfaces that offer the choice: the popover and the Materiały tab print
  // this same lock, so they can never disagree about whether the choice is available.
  const pricingLockedReason = settlementMode === 'GROSS' ? MATERIALS_GROSS_LOCK_REASON : undefined
  const gutter = flush ? undefined : 'px-4'
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
      {/* Pinned top bar — the view toggle plus the settings trigger, so its height never moves. The
          settings block sat here once as an inline section and had to be evicted: growing it squeezed
          SummaryScrollRegion into a sliver, two containers fighting over one fixed height. It is back
          as a popover, whose content is portalled out of flow and so adds no height to this bar. */}
      <div className={cn('flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 pt-4', gutter)}>
        <ToggleGroup
          options={viewOptions}
          value={view}
          onChange={setSummaryView}
          aria-label="Widok podsumowania"
        />
        {/* A client reads the mode, never writes it — the same `preview` gate every other
            owner-only affordance in this panel uses. Supplying the two writers is what makes a host
            an editor of these settings; a read-only host (no writers) renders no trigger at all. */}
        {!preview && changeSettlementMode && onMaterialsNetRateChange && (
          <SummaryInvestmentSettings
            vatRate={vatRate}
            settlementMode={settlementMode}
            onSettlementModeChange={changeSettlementMode}
            // The EFFECTIVE rate, not the stored one: at tryb brutto the saved rate is inert, and the
            // popover printing „Netto" while the Materiały tab beside it printed „Brutto" made one
            // setting answer its own question two ways on one screen. Nothing is lost — the rate is
            // kept, so switching back to netto brings it and its figures back.
            materialsNetRate={effectiveNetRate}
            onMaterialsNetRateChange={onMaterialsNetRateChange}
            pricingLockedReason={pricingLockedReason}
            isSaving={isSavingSettings}
            showSettingsBar={showSettingsBar}
          />
        )}
        {topBarSlot}
      </div>
      <SummaryScrollRegion>
        {view === 'subcontractors' && subcontractorDue ? (
          <SubcontractorSummary
            investmentId={investmentId}
            subcontractorDue={subcontractorDue}
            payoutTransactions={payoutTransactions ?? []}
            stages={stages}
            workers={workers}
            showGlobalSettings={showSettingsBar}
            showTransactions={showTransactionLists}
          />
        ) : (
          <div className={cn('flex w-full flex-col gap-y-4 pt-4 pb-4', gutter)}>
            {view === 'summary' && (
              <SummaryOverviewTab
                investmentId={investmentId}
                settlementMode={settlementMode}
                // Same gate as the settings trigger above: a client reads the mode, and only a host
                // that supplied the writer may edit it from inside the tab.
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
                showDeposits={showTransactionLists}
                preview={preview}
                showPie={showPies}
              />
            )}
            {view === 'expenses' && (
              <SummaryExpensesTab
                investmentId={investmentId}
                investmentName={investmentName}
                materialsBreakdown={materialsBreakdown}
                // Owner plane — dropped here too, not only by the client share omitting it upstream:
                // marża-side spend must fail closed on every path into a client render.
                settledBreakdown={preview ? undefined : settledBreakdown}
                materialTransactions={materialTransactions ?? []}
                materialsNetRate={effectiveNetRate}
                vatRate={vatRate}
                onMaterialsNetRateChange={preview ? undefined : onMaterialsNetRateChange}
                isSavingSettings={isSavingSettings}
                pricingLockedReason={pricingLockedReason}
                preview={preview}
                showTransactions={showTransactionLists}
                showPie={showPies}
              />
            )}

            {view === 'stages' && stages && stageTotals && (
              <SummaryStagesTab
                stages={stages}
                stageTotals={stageTotals}
                executedNet={totalNet ?? 0}
                sectionSubtotals={sectionSubtotals ?? []}
                vatRate={vatRate}
              />
            )}
            {view === 'margin' && financials && subcontractorDue && (
              <SummaryMarginTab
                financials={financials}
                laborCostsNet={laborCostsNet}
                discountAmount={discountAmount}
                // `combined`, not one plane: each etap is already valued at the plane it carries,
                // so the two halves are one bill.
                subcontractor={toSettlement(subcontractorDue)}
                forecastByPlane={marginForecastByPlane}
              />
            )}
          </div>
        )}
      </SummaryScrollRegion>
    </>
  )
}
