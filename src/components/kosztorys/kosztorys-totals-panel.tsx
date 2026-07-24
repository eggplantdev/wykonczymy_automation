'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { bucketDepositsByPlane, computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'
import { KosztorysStageTotals } from '@/components/kosztorys/kosztorys-stage-totals'
import { SummaryOverviewTab } from '@/components/kosztorys/summary-overview-tab'
import { SummaryExpensesTab } from '@/components/kosztorys/summary-expenses-tab'
import { SummaryDepositsTab } from '@/components/kosztorys/summary-deposits-tab'
import { SubcontractorSummary } from '@/components/kosztorys/subcontractor-summary'
import { CollapsiblePanelTrigger } from '@/components/ui/collapsible-panel-trigger'
import { SummaryScrollRegion } from '@/components/ui/summary-grid'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import { useSummaryAxis } from '@/components/kosztorys/use-summary-axis'
import { useSummaryView, type SummaryViewT } from '@/components/kosztorys/use-summary-view'
import { useMaterialsNetPricing } from '@/components/kosztorys/use-materials-net-pricing'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
  MaterialTransactionRowT,
} from '@/types/reference-data'

const SUMMARY_VIEW_OPTIONS: OptionT<SummaryViewT>[] = [
  { value: 'summary', label: 'Podsumowanie' },
  { value: 'wydatki', label: 'Wydatki' },
  { value: 'wplaty', label: 'Wpłaty' },
  { value: 'etapy', label: 'Robocizna per etap' },
]

type PropsT = {
  investmentId: number
  stages: KosztorysStageT[]
  stageTotals: Map<number, number>
  // Realized PAYOUTs per worker — feeds the subcontractor summary block (Z/Bez narzędzi views only).
  payoutsByWorker: SubcontractorPayoutRowT[]
  // Individual realized PAYOUT rows — feed the subcontractor block's sortable wypłaty list.
  payoutTransactions: PayoutTransactionRowT[]
  // Individual deposit rows — feed the client Podsumowanie's sortable wpłaty list.
  depositTransactions: DepositTransactionRowT[]
  // Individual materiały rows — feed the Podsumowanie's wydatki list (data · typ · kwota).
  materialTransactions: MaterialTransactionRowT[]
  // „Suma wykonanej pracy" (należne) at the active view's subcontractor price, pre-rabat — the
  // subcontractor block's headline figure. Ignored in the client view.
  subcontractorDueNet: number
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals); EtapTotals' readout.
  totalNet: number
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNetFromKosztorys: number
  // Materiały brutto — server sum of the investment's unsettled transactions (recorded brutto).
  materialsGross: number
  // Per-expense-category split of materialsGross (v1 parity); Σ === materialsGross.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  // Investor's wpłaty (totalIncome — every deposit on the investment) — subtracted to reach the
  // still-owed „Do zapłaty" total.
  wplatyNet: number
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (the body computes it unconditionally); clientView suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The recon verdict is client-view-fixed, so the scream only shows in 'client';
  // in a subcontractor view the displayed figure is repriced and the scream would misread.
  priceView: PriceViewT
  vatRate: number
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  clientView?: boolean
}

// The bottom totals block: Suma transzy per etap + the merged Podsumowanie table (Suma prac →
// Rabat → Robocizna / Materiały / Łącznie − Zaliczki), folded into one collapsible panel.
// Collapsed, it keeps the still-owed „Do zapłaty" total visible so the headline never disappears.
export function KosztorysTotalsPanel({
  investmentId,
  stages,
  stageTotals,
  payoutsByWorker,
  payoutTransactions,
  depositTransactions,
  materialTransactions,
  subcontractorDueNet,
  totalNet,
  laborCostsNetFromKosztorys,
  materialsGross,
  materialyBreakdown,
  sectionSubtotals,
  wplatyNet,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  clientView = false,
}: PropsT) {
  const [open, setOpen] = useTotalsPanelOpen()
  // The panel's own netto/brutto axis, independent of the Widok dropdown — that one keeps
  // governing the grid columns only; this switch governs every figure inside the panel.
  const [moneyAxis, setMoneyAxis] = useSummaryAxis()
  // Which client-plane view is shown (Podsumowanie / Wydatki / Wpłaty) — independent of the grid's
  // price view. Disabled on the subcontractor plane, which renders its own summary instead.
  const [summaryView, setSummaryView] = useSummaryView()
  // „Mieszane" ('cash') shows BOTH netto and brutto columns, then a cash split block — the settlement
  // anchors on brutto (matching the brutto „Do zapłaty" column at C = 0), while netto stays visible
  // beside it. Every other value is a real MoneyAxisT the children read directly.
  const cashMode = moneyAxis === 'cash'
  // The toggle shows one money column — the chosen one. Mieszane is the exception: it's a mixed
  // netto+brutto settlement, so it shows both columns alongside the gotówka block.
  const displayAxis: MoneyAxisT = moneyAxis === 'cash' ? 'both' : moneyAxis
  // Materiały netto pricing: when on, netto = brutto − VAT (the historical default); when off,
  // materiały stay at their raw brutto amount on both axes. Only moves netto figures, so the toggle
  // is offered only where netto is on show and there are materiały to reprice.
  const [materialsAsNet, setMaterialsAsNet] = useMaterialsNetPricing()
  const nettoShown = moneyAxis !== 'gross'
  const vatPercent = Math.round(vatRate * 100)
  // Temporary client-side experiment (server-persisted later, so the transactions balance can
  // reconcile): by how many % to knock brutto down to reach materiały netto. Seeded from the VAT
  // rate, then the owner moves it to test whether a straight brutto reduction is the right model.
  const [materialsReductionPercent, setMaterialsReductionPercent] = useState(vatPercent)
  const materialsReduction = materialsReductionPercent / 100
  // Wpłaty split by VAT plane for tryb mieszany: NET (+ unmarked) settle the netto section,
  // GROSS the brutto section. Derived from the deposit list, never typed.
  const { paidNet, paidGross } = bucketDepositsByPlane(depositTransactions)
  // The subcontractor plane (Z/Bez narzędzi) has no VAT axis and its own headline figure, so the
  // client „Do zapłaty" only applies in the client view.
  const isClientPlane = priceView === 'client'
  // Computed here and passed down: the collapsed headline and the Podsumowanie row show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const doZaplaty = computeDoZaplatyRM(
    laborCostsNetFromKosztorys,
    wplatyNet,
    materialsGross,
    vatRate,
    materialsAsNet,
    materialsReduction,
  )
  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      // The open/close animation lives on the ROOT's height (h-12 ↔ 100%), not on the Content's
      // Radix keyframes — those animate the measured natural content height, which disagrees with
      // the flex-stretched full height and made the close look two-phased. Content stays mounted
      // (forceMount) so it can't blink out mid-transition; visibility flips only once closed.
      className="border-border bg-background text-foreground shadow-panel absolute inset-x-0 bottom-0 z-20 flex h-15 flex-col overflow-hidden border-t transition-[height] duration-200 ease-out data-[state=open]:h-full"
    >
      {/* Open, the toolbar's Podsumowanie button is the close affordance — the trigger row only
          renders collapsed, as the visible handle for the panel. */}
      <CollapsiblePanelTrigger
        label={isClientPlane ? 'Podsumowanie' : 'Podsumowanie podwykonawców'}
        className="data-[state=open]:hidden"
      />
      {/* Pinned to the panel, not the scroll region, so it stays put while content scrolls.
          top-4 + h-8 mirror the axis toggle's offset and height, centering the two on one line. */}
      {open && (
        <button
          onClick={() => setOpen(false)}
          aria-label="Zwiń podsumowanie"
          className="absolute top-4 right-4 z-10 flex h-8 cursor-pointer items-center"
        >
          <ChevronDown className="text-muted-foreground hover:text-foreground size-8" />
        </button>
      )}
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        {/* Pinned top bar — the view toggle (Podsumowanie / Wydatki / Wpłaty) stays visible while the
            content scrolls below it. Rendered on both planes but disabled on the subcontractor plane,
            which has its own summary; the toggle only governs the client plane for now. pr keeps the
            toggle clear of the absolute close affordance in the top-right corner. */}
        <div className="border-border flex shrink-0 items-center border-b px-4 py-2 pr-16">
          <ToggleGroup
            options={SUMMARY_VIEW_OPTIONS}
            value={summaryView}
            onChange={setSummaryView}
            size="lg"
            disabled={!isClientPlane}
            aria-label="Widok podsumowania"
          />
        </div>
        {/* One scroll container for both planes — the content clears the toolbar instead of hiding
            under it, identically whichever plane is active; the trigger above stays pinned. */}
        <SummaryScrollRegion>
          {isClientPlane ? (
            // One flex column owns every vertical gap in the active view — each block is a sibling on a
            // single `gap-y-8` so spacing stays uniform. Which blocks render is the top toggle's job:
            // Podsumowanie (summary + Suma transzy), Wydatki (materiały controls + list), Wpłaty (deposits).
            <div className="flex w-full flex-col gap-y-4 px-4 pt-4 pb-10">
              {summaryView === 'wydatki' && (
                <SummaryExpensesTab
                  investmentId={investmentId}
                  materialsGross={materialsGross}
                  materialyBreakdown={materialyBreakdown}
                  materialTransactions={materialTransactions}
                  nettoShown={nettoShown}
                  materialsAsNet={materialsAsNet}
                  onMaterialsAsNetChange={setMaterialsAsNet}
                  materialsReductionPercent={materialsReductionPercent}
                  onMaterialsReductionPercentChange={setMaterialsReductionPercent}
                  clientView={clientView}
                />
              )}
              {summaryView === 'summary' && (
                <SummaryOverviewTab
                  investmentId={investmentId}
                  moneyAxis={moneyAxis}
                  onMoneyAxisChange={setMoneyAxis}
                  laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
                  doZaplaty={doZaplaty}
                  materialsGross={materialsGross}
                  materialyBreakdown={materialyBreakdown}
                  sectionSubtotals={sectionSubtotals}
                  wplatyNet={wplatyNet}
                  rabatAmount={rabatAmount}
                  reconciliation={reconciliation}
                  priceView={priceView}
                  vatRate={vatRate}
                  deriveMaterialsNet={materialsAsNet}
                  materialsReduction={materialsReduction}
                  paidNet={paidNet}
                  paidGross={paidGross}
                  clientView={clientView}
                />
              )}
              {summaryView === 'wplaty' && (
                <SummaryDepositsTab
                  investmentId={investmentId}
                  rows={depositTransactions}
                  showPlane={cashMode}
                  clientView={clientView}
                />
              )}
              {/* „Robocizna per etap" (Netto/Brutto per stage) — a client/VAT figure; the
                  subcontractor plane has no VAT axis (EX-558), so it renders only on this plane.
                  The axis it reads is set by the Podsumowanie tab's toggle (shared panel state). */}
              {summaryView === 'etapy' && (
                <KosztorysStageTotals
                  stages={stages}
                  stageTotals={stageTotals}
                  wykonaneNet={totalNet}
                  vatRate={vatRate}
                  moneyAxis={displayAxis}
                />
              )}
            </div>
          ) : (
            <SubcontractorSummary
              investmentId={investmentId}
              dueNet={subcontractorDueNet}
              payouts={payoutsByWorker}
              payoutTransactions={payoutTransactions}
            />
          )}
        </SummaryScrollRegion>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
