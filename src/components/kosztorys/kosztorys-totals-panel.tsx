'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { computeDoZaplatyRM, type DepositBucketsT } from '@/lib/kosztorys/summary-economics'
import { KosztorysDoZaplatyBlock } from '@/components/kosztorys/kosztorys-do-zaplaty-block'
import { KosztorysEtapTotals } from '@/components/kosztorys/kosztorys-etap-totals'
import { KosztorysSummary } from '@/components/kosztorys/kosztorys-summary'
import { SubcontractorSummary } from '@/components/kosztorys/subcontractor-summary'
import { computeSubcontractorSummary } from '@/lib/kosztorys/subcontractor-summary'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { SubcontractorPayoutRowT, PayoutTransactionRowT } from '@/types/reference-data'

type PropsT = {
  investmentId: number
  stages: KosztorysStageT[]
  stageTotals: Map<number, number>
  // Realized PAYOUTs per worker — feeds the subcontractor summary block (Z/Bez narzędzi views only).
  payoutsByWorker: SubcontractorPayoutRowT[]
  // TEMP (design spike): individual PAYOUT rows for the per-worker expand + flat „wszystkie wypłaty" list.
  payoutTransactions: PayoutTransactionRowT[]
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
  // Investor deposits split by plane — subtracted (per the sequential model) to reach „Do zapłaty".
  depositBuckets: DepositBucketsT
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream. Always supplied
  // (the body computes it unconditionally); clientView suppresses the scream downstream, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The recon verdict is client-view-fixed, so the scream only shows in 'client';
  // in a subcontractor view the displayed figure is repriced and the scream would misread.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
  // Read-only client render: gate the mismatch scream and render internal links as plain text.
  clientView?: boolean
}

// The bottom totals block: Suma transzy per etap + the merged Podsumowanie table (Suma prac →
// Rabat → Robocizna / Materiały / Łącznie) plus the hide-exempt Wpłaty / Do zapłaty block, folded
// into one collapsible panel. Collapsed, it keeps those four figures visible so the headline never
// disappears.
export function KosztorysTotalsPanel({
  investmentId,
  stages,
  stageTotals,
  payoutsByWorker,
  payoutTransactions,
  subcontractorDueNet,
  totalNet,
  laborCostsNetFromKosztorys,
  materialyNet,
  materialyBreakdown,
  sectionSubtotals,
  depositBuckets,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  moneyAxis,
  clientView = false,
}: PropsT) {
  const [open, setOpen] = useTotalsPanelOpen()
  // The subcontractor plane (Z/Bez narzędzi) has no VAT axis and its own headline figure, so the
  // client „Do zapłaty" only applies in the client view.
  const isClientPlane = priceView === 'client'
  // Computed here and passed down: the collapsed headline and the Podsumowanie block show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const doZaplaty = computeDoZaplatyRM(
    laborCostsNetFromKosztorys,
    depositBuckets,
    materialyNet,
    vatRate,
  )
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
      className="border-border bg-background text-foreground absolute inset-x-0 bottom-0 z-20 border-t shadow-[0_-2px_8px_-4px_rgba(0,0,0,0.2)]"
    >
      <Collapsible.Trigger className="hover:bg-muted/40 flex w-full cursor-pointer items-baseline gap-3 px-4 py-1.5 text-left text-sm">
        <ChevronDown
          className={cn(
            'text-muted-foreground size-4 shrink-0 self-center transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
        <span className="font-medium">
          {isClientPlane ? 'Podsumowanie' : 'Podsumowanie podwykonawców'}
        </span>
        {/* Collapsed: keep the headline figures visible; open: the table carries them. Client plane =
            the four hide-exempt Wpłaty / Do zapłaty figures (same block as the expanded state);
            subcontractor plane = „Pozostało do wypłaty" (no VAT axis). */}
        {!open &&
          (isClientPlane ? (
            <span className="ml-auto">
              <KosztorysDoZaplatyBlock deposits={depositBuckets} doZaplaty={doZaplaty} />
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
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        {isClientPlane ? (
          <>
            {/* „Suma transzy" (per-etap, Netto/Brutto) is a client/VAT figure — the subcontractor plane
                has no VAT axis (EX-558), so it renders only here. */}
            <KosztorysEtapTotals
              stages={stages}
              stageTotals={stageTotals}
              wykonaneNet={totalNet}
              vatRate={vatRate}
              moneyAxis={moneyAxis}
            />
            <KosztorysSummary
              investmentId={investmentId}
              laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
              doZaplaty={doZaplaty}
              materialyNet={materialyNet}
              materialyBreakdown={materialyBreakdown}
              sectionSubtotals={sectionSubtotals}
              deposits={depositBuckets}
              rabatAmount={rabatAmount}
              reconciliation={reconciliation}
              priceView={priceView}
              vatRate={vatRate}
              moneyAxis={moneyAxis}
              clientView={clientView}
            />
          </>
        ) : (
          <SubcontractorSummary
            investmentId={investmentId}
            dueNet={subcontractorDueNet}
            payouts={payoutsByWorker}
            payoutTransactions={payoutTransactions}
          />
        )}
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
