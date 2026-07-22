'use client'

import { useState } from 'react'
import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, MONEY_AXIS_DEFAULT, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { SimpleTooltip } from '@/components/ui/tooltip'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'
import { KosztorysStageTotals } from '@/components/kosztorys/kosztorys-stage-totals'
import { KosztorysSummary } from '@/components/kosztorys/kosztorys-summary'
import { SubcontractorSummary } from '@/components/kosztorys/subcontractor-summary'
import { SUMMARY_PANEL_SCROLL } from '@/components/kosztorys/summary-grid'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type {
  SubcontractorPayoutRowT,
  PayoutTransactionRowT,
  DepositTransactionRowT,
} from '@/types/reference-data'

// The summary's own axis pick — 'both' reads „Mieszana" here (a partly-net, partly-gross
// settlement), not the grid toggle's „Pokaż wszystko".
const SUMMARY_AXIS_OPTIONS: OptionT<MoneyAxisT>[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
  { value: 'both', label: 'Mieszana' },
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
  materialyNet: number
  // Per-expense-category split of materialyNet (v1 parity); Σ === materialyNet.
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
  materialyNet,
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
  const [moneyAxis, setMoneyAxis] = useState<MoneyAxisT>(MONEY_AXIS_DEFAULT)
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // The subcontractor plane (Z/Bez narzędzi) has no VAT axis and its own headline figure, so the
  // client „Do zapłaty" only applies in the client view.
  const isClientPlane = priceView === 'client'
  // Computed here and passed down: the collapsed headline and the Podsumowanie row show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const doZaplaty = computeDoZaplatyRM(laborCostsNetFromKosztorys, wplatyNet, materialyNet, vatRate)
  // Subcontractor headline: „Pozostało do wypłaty" (należne − zaliczki), shown collapsed in place of
  // the client „Do zapłaty".
  const { remaining: subcontractorRemaining } = computeSubcontractorSummary(
    subcontractorDueNet,
    payoutsByWorker,
  )

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="border-border bg-background text-foreground absolute inset-x-0 bottom-0 z-20 flex max-h-full flex-col border-t shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.2)]"
    >
      <Collapsible.Trigger className="hover:bg-muted/40 flex w-full shrink-0 cursor-pointer items-baseline gap-3 px-4 py-1.5 text-left text-sm">
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 self-center transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        <span className="font-medium">
          {isClientPlane ? 'Podsumowanie' : 'Podsumowanie podwykonawców'}
        </span>
        {/* Collapsed: keep the headline figure visible; open: the table carries it. Client plane =
            robocizna „Do zapłaty" (netto/brutto); subcontractor plane = „Pozostało do wypłaty" (no VAT axis). */}
        {!open &&
          (isClientPlane ? (
            <span className="text-muted-foreground ml-auto flex items-baseline gap-x-4 tabular-nums">
              <span>Do zapłaty</span>
              {showNet && (
                <span className="flex items-baseline gap-x-1.5">
                  <span className="text-muted-foreground text-xs">netto</span>
                  <span className="text-foreground font-medium">{formatNet(doZaplaty.net)}</span>
                </span>
              )}
              {showGross && (
                <span className="flex items-baseline gap-x-1.5">
                  <span className="text-muted-foreground text-xs">brutto</span>
                  <span className="text-foreground font-medium">{formatNet(doZaplaty.gross)}</span>
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground ml-auto flex items-baseline gap-x-1.5 tabular-nums">
              <span>Pozostało do wypłaty</span>
              <span className="text-foreground font-medium">
                {formatNet(subcontractorRemaining)}
              </span>
            </span>
          ))}
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* One scroll container for both planes — the content clears the toolbar instead of hiding
            under it, identically whichever plane is active; the trigger above stays pinned. */}
        <div className={SUMMARY_PANEL_SCROLL}>
          {isClientPlane ? (
            <div className="flex w-full flex-col">
              <div className="px-4 pt-3">
                <SimpleTooltip content="Mieszana oznacza, że inwestycja jest rozliczana częściowo netto, częściowo brutto.">
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
              </div>
              <div className="flex w-full flex-wrap items-start">
                <KosztorysSummary
                  investmentId={investmentId}
                  laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
                  doZaplaty={doZaplaty}
                  materialyNet={materialyNet}
                  materialyBreakdown={materialyBreakdown}
                  sectionSubtotals={sectionSubtotals}
                  wplatyNet={wplatyNet}
                  depositTransactions={depositTransactions}
                  rabatAmount={rabatAmount}
                  reconciliation={reconciliation}
                  priceView={priceView}
                  vatRate={vatRate}
                  moneyAxis={moneyAxis}
                  clientView={clientView}
                />
                {/* „Suma transzy" (per-etap, Netto/Brutto) is a client/VAT figure — the subcontractor
                  plane has no VAT axis (EX-558), so it renders only here. Sits beside the Podsumowanie. */}
                <KosztorysStageTotals
                  stages={stages}
                  stageTotals={stageTotals}
                  wykonaneNet={totalNet}
                  vatRate={vatRate}
                  moneyAxis={moneyAxis}
                />
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
