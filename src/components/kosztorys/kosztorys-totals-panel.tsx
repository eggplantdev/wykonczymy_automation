'use client'

import * as Collapsible from '@radix-ui/react-collapsible'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { computeDoZaplatyRM } from '@/lib/kosztorys/summary-economics'
import { KosztorysEtapTotals } from '@/components/kosztorys/kosztorys-etap-totals'
import { KosztorysSummary } from '@/components/kosztorys/kosztorys-summary'
import { useTotalsPanelOpen } from '@/components/kosztorys/use-totals-panel-open'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { KosztorysStageT } from '@/lib/kosztorys/types'

type PropsT = {
  investmentId: number
  stages: KosztorysStageT[]
  stageTotals: Map<number, number>
  zaliczkiByStage: Record<number, number>
  // Suma prac wykonanych — the executed total BEFORE rabat (Σ etap totals); EtapTotals' readout.
  totalNet: number
  // Robocizna wartość netto — executed total AFTER rabat; the Podsumowanie waterfall's base.
  laborCostsNetFromKosztorys: number
  materialyNet: number
  // Per-expense-category split of materialyNet (v1 parity); Σ === materialyNet.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Investor's wpłaty (totalIncome — every deposit on the investment) — subtracted to reach the
  // still-owed „Do zapłaty" total. Distinct from zaliczkiByStage (the sparser per-etap tagged subset).
  wplatyNet: number
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — drives the Podsumowanie mismatch scream.
  reconciliation: KosztorysReconciliationT
  // Active price view. The recon verdict is client-view-fixed, so the scream only shows in 'client';
  // in a subcontractor view the displayed figure is repriced and the scream would misread.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
}

// The bottom totals block: Suma transzy per etap + the merged Podsumowanie table (Suma prac →
// Rabat → Robocizna / Materiały / Łącznie − Zaliczki), folded into one collapsible panel.
// Collapsed, it keeps the still-owed „Do zapłaty" total visible so the headline never disappears.
export function KosztorysTotalsPanel({
  investmentId,
  stages,
  stageTotals,
  zaliczkiByStage,
  totalNet,
  laborCostsNetFromKosztorys,
  materialyNet,
  materialyBreakdown,
  wplatyNet,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  moneyAxis,
}: PropsT) {
  const [open, setOpen] = useTotalsPanelOpen()
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // Computed here and passed down: the collapsed headline and the Podsumowanie row show the same
  // „Do zapłaty", so it has one source rather than two calls that must be kept in step.
  const doZaplaty = computeDoZaplatyRM(laborCostsNetFromKosztorys, wplatyNet, materialyNet, vatRate)

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
        <span className="font-medium">Podsumowanie</span>
        {/* Collapsed: keep the robocizna „Do zapłaty" headline visible; open: the table carries it. */}
        {!open && (
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
        )}
      </Collapsible.Trigger>
      <Collapsible.Content className="data-[state=closed]:animate-collapse-up data-[state=open]:animate-collapse-down overflow-hidden">
        <KosztorysEtapTotals
          investmentId={investmentId}
          stages={stages}
          stageTotals={stageTotals}
          zaliczkiByStage={zaliczkiByStage}
          wplatyNet={wplatyNet}
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
          wplatyNet={wplatyNet}
          rabatAmount={rabatAmount}
          reconciliation={reconciliation}
          priceView={priceView}
          vatRate={vatRate}
          moneyAxis={moneyAxis}
        />
      </Collapsible.Content>
    </Collapsible.Root>
  )
}
