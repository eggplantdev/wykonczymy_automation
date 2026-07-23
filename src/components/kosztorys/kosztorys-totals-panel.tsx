'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { Checkbox } from '@/components/ui/checkbox'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { bucketDepositsByPlane, computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'
import { CashSettlement } from '@/components/kosztorys/cash-settlement'
import { DepositsTable } from '@/components/kosztorys/deposits-table'
import { KosztorysStageTotals } from '@/components/kosztorys/kosztorys-stage-totals'
import { KosztorysSummary } from '@/components/kosztorys/kosztorys-summary'
import { SubcontractorSummary } from '@/components/kosztorys/subcontractor-summary'
import { CollapsiblePanelTrigger } from '@/components/ui/collapsible-panel-trigger'
import { SUMMARY_PANEL_SCROLL } from '@/components/kosztorys/summary-grid'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import { useSummaryAxis, type PanelAxisT } from '@/components/kosztorys/use-summary-axis'
import { useMaterialsNetPricing } from '@/components/kosztorys/use-materials-net-pricing'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
} from '@/types/reference-data'

const SUMMARY_AXIS_OPTIONS: OptionT<PanelAxisT>[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
  { value: 'both', label: 'Netto + Brutto' },
  { value: 'cash', label: 'Mieszane' },
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
  // „Mieszane" ('cash') shows BOTH netto and brutto columns, then a cash split block — the settlement
  // anchors on brutto (matching the brutto „Do zapłaty" column at C = 0), while netto stays visible
  // beside it. Every other value is a real MoneyAxisT the children read directly.
  const cashMode = moneyAxis === 'cash'
  const displayAxis: MoneyAxisT = moneyAxis === 'cash' ? 'both' : moneyAxis
  // Materiały netto pricing: when on, netto = brutto − VAT (the historical default); when off,
  // materiały stay at their raw brutto amount on both axes. Only moves netto figures, so the toggle
  // is offered only where netto is on show and there are materiały to reprice.
  const [materialsAsNet, setMaterialsAsNet] = useMaterialsNetPricing()
  const nettoShown = moneyAxis !== 'gross'
  const vatPercent = Math.round(vatRate * 100)
  // „Do rozliczenia netto" is derived, not typed: Σ deposits flagged NET is the gotówka part.
  const cashAmount = bucketDepositsByPlane(depositTransactions).paidNet
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
      <CollapsiblePanelTrigger
        label={isClientPlane ? 'Podsumowanie' : 'Podsumowanie podwykonawców'}
      />
      <Collapsible.Content
        forceMount
        className="flex min-h-0 flex-1 flex-col overflow-hidden transition-[visibility] duration-200 data-[state=closed]:invisible"
      >
        {/* One scroll container for both planes — the content clears the toolbar instead of hiding
            under it, identically whichever plane is active; the trigger above stays pinned. */}
        <div className={SUMMARY_PANEL_SCROLL}>
          {isClientPlane ? (
            <div className="flex w-full flex-col">
              <div className="px-4 pt-3">
                <SimpleTooltip content="Mieszane oznacza, że inwestycja jest rozliczana częściowo netto, częściowo brutto.">
                  {/* ToggleGroup doesn't spread props, so the trigger needs a real element. */}
                  <span className="inline-flex">
                    <ToggleGroup
                      options={SUMMARY_AXIS_OPTIONS}
                      value={moneyAxis}
                      onChange={setMoneyAxis}
                      aria-label="Rozliczenie netto lub brutto"
                    />
                  </span>
                </SimpleTooltip>
                {nettoShown && materialsGross !== 0 && (
                  <label className="text-muted-foreground mt-2 flex w-fit cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={materialsAsNet}
                      onCheckedChange={(value) => setMaterialsAsNet(value === true)}
                    />
                    Wydatki inwestycyjne wyceniane po kwocie netto (−{vatPercent}%)
                  </label>
                )}
              </div>
              {/* The container owns the tables' shared spacing — children carry no top offset of
                  their own, so every table's header lands on the same line. Row 1 is the summary
                  block + its side tables; row 2 is the wpłaty list + its reconciliation, so a wide
                  deposits row can't stretch the summary column and push the side tables away. */}
              <div className="flex w-full flex-col gap-y-8 px-4 pt-3 pb-10">
                <div className="flex w-full flex-wrap items-start gap-x-12 gap-y-8">
                  <KosztorysSummary
                    investmentId={investmentId}
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
                    moneyAxis={displayAxis}
                    deriveMaterialsNet={materialsAsNet}
                    clientView={clientView}
                  />
                  {cashMode && (
                    <div className="flex flex-col gap-1 self-start">
                      <CashSettlement
                        combinedNet={doZaplaty.net + wplatyNet}
                        wplatyNet={wplatyNet}
                        vatRate={vatRate}
                        cashAmount={cashAmount}
                      />
                      <p className="text-muted-foreground w-fit max-w-3xs text-xs text-balance">
                        Wpłaty bez oznaczenia netto/brutto są traktowane jako netto.
                      </p>
                    </div>
                  )}
                  {/* „Suma transzy" (per-etap, Netto/Brutto) is a client/VAT figure — the subcontractor
                    plane has no VAT axis (EX-558), so it renders only here. Sits beside the Podsumowanie. */}
                  <KosztorysStageTotals
                    stages={stages}
                    stageTotals={stageTotals}
                    wykonaneNet={totalNet}
                    vatRate={vatRate}
                    moneyAxis={displayAxis}
                  />
                </div>
                {depositTransactions.length > 0 && (
                  <DepositsTable
                    investmentId={investmentId}
                    rows={depositTransactions}
                    clientView={clientView}
                    showPlane={cashMode}
                  />
                )}
              </div>
            </div>
          ) : (
            <SubcontractorSummary
              investmentId={investmentId}
              dueNet={subcontractorDueNet}
              payouts={payoutsByWorker}
              payoutTransactions={payoutTransactions}
            />
          )}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
