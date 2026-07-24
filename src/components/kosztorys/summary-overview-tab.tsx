'use client'

import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import { CashSettlement } from '@/components/kosztorys/cash-settlement'
import { KosztorysSummary } from '@/components/kosztorys/kosztorys-summary'
import { type PanelAxisT } from '@/components/kosztorys/use-summary-axis'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import type { KosztorysReconciliationT } from '@/lib/kosztorys/reconciliation'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'

const SUMMARY_AXIS_OPTIONS: OptionT<PanelAxisT>[] = [
  { value: 'net', label: 'Netto' },
  { value: 'gross', label: 'Brutto' },
  { value: 'cash', label: 'Mieszane' },
]

type PropsT = {
  investmentId: number
  // The subsection's own netto/brutto/Mieszane axis + its setter — the control lives at the top of
  // this tab because it governs only the figures below it, not the panel-wide view toggle.
  moneyAxis: PanelAxisT
  onMoneyAxisChange: (value: PanelAxisT) => void
  laborCostsNetFromKosztorys: number
  doZaplaty: MoneyPairT
  materialsGross: number
  materialyBreakdown: MaterialyBreakdownRowT[]
  sectionSubtotals: SectionSliceInputT[]
  wplatyNet: number
  rabatAmount: number
  reconciliation: KosztorysReconciliationT
  priceView: PriceViewT
  vatRate: number
  // Materiały-netto pricing (checkbox + reduction %) — shared panel state, feeds both figures.
  deriveMaterialsNet: boolean
  materialsReduction: number
  // Wpłaty split by VAT plane — feeds the tryb mieszany settlement.
  paidNet: number
  paidGross: number
  clientView?: boolean
}

// The „Podsumowanie" view: its own axis control on top, then the settlement below. Mieszane swaps the
// two-column KosztorysSummary for the vertical netto→brutto CashSettlement; Netto/Brutto keep the table.
export function SummaryOverviewTab({
  investmentId,
  moneyAxis,
  onMoneyAxisChange,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materialsGross,
  materialyBreakdown,
  sectionSubtotals,
  wplatyNet,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
  paidNet,
  paidGross,
  clientView = false,
}: PropsT) {
  const cashMode = moneyAxis === 'cash'
  const displayAxis: MoneyAxisT = cashMode ? 'both' : moneyAxis

  return (
    <div className="flex w-full flex-col gap-y-4">
      {cashMode ? (
        <CashSettlement
          laborCostsNetFromKosztorys={laborCostsNetFromKosztorys}
          materialsGross={materialsGross}
          vatRate={vatRate}
          deriveMaterialsNet={deriveMaterialsNet}
          materialsReduction={materialsReduction}
          paidNet={paidNet}
          paidGross={paidGross}
          rabatAmount={rabatAmount}
        />
      ) : (
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
          deriveMaterialsNet={deriveMaterialsNet}
          materialsReduction={materialsReduction}
          clientView={clientView}
        />
      )}
      {/* The netto/brutto/Mieszane axis governs only the Podsumowanie figures, so it lives inside this
          tab (right below the tables) rather than in a panel-wide bar. */}
      <div>
        <ToggleGroup
          options={SUMMARY_AXIS_OPTIONS}
          value={moneyAxis}
          onChange={onMoneyAxisChange}
          aria-label="Rozliczenie netto lub brutto"
        />
        <p className="text-muted-foreground mt-2 max-w-xs text-xs">
          ℹ️ Mieszane oznacza, że inwestycja jest rozliczana częściowo netto, częściowo brutto.
        </p>
      </div>
    </div>
  )
}
