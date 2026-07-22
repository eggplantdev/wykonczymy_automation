'use client'

import {
  computeSummarySplit,
  faceValue,
  moneyPair,
  summaryLine,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet } from '@/lib/kosztorys/format'
import { axisShows, type MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { summaryMoneyCols } from '@/components/kosztorys/summary-grid'
import { SummaryRow, SummaryTable } from '@/components/kosztorys/summary-grid'
import { SummaryBreakdownTable } from '@/components/kosztorys/summary-breakdown-table'
import { SummaryTotalsTable } from '@/components/kosztorys/summary-totals-table'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie) — client-side, reacts to unsaved edits.
  laborCostsNetFromKosztorys: number
  // The „Do zapłaty" pair (robocizna + materiały − wpłaty), computed by the panel so its collapsed
  // headline and this table's bottom row can't drift apart.
  doZaplaty: MoneyPairT
  // Materiały brutto — live server sum of the investment's unsettled transactions (recorded brutto;
  // netto is derived by removing VAT).
  materialsGross: number
  // Per-expense-category split of materialsGross (v1 parity); Σ === materialsGross.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  // Wpłaty netto — the investor's deposits on this investment (totalIncome); subtracted from
  // Łącznie to reach „Do zapłaty". Matches the investment page's „Wpłaty" by construction.
  wplatyNet: number
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  rabatAmount: number
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this. Always supplied
  // (the body computes it unconditionally); clientView suppresses the scream via reconVisible, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The verdict compares client-view nets, so the scream only reads correctly in
  // 'client'; a subcontractor view reprices the displayed figure, so the scream is suppressed there.
  priceView: PriceViewT
  vatRate: number
  moneyAxis: MoneyAxisT
  // Read-only client render: the mismatch scream is an owner-internal signal (a client's view is
  // always 'client', which is exactly when the scream would fire), and the internal drill-down links
  // point at owner-only pages — so gate the scream off and render those labels as plain text.
  clientView?: boolean
}

// The single bottom summary block: the robocizna waterfall (Suma prac wykonanych → Rabat →
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie), then
// Wpłaty subtracted to reach „Do zapłaty" — one grid, no separate totals bar.
export function KosztorysSummary({
  investmentId,
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
  moneyAxis,
  clientView = false,
}: PropsT) {
  // „Suma prac wykonanych" is shown net of rabat, matching „Suma transzy" (both are the executed
  // value after discount). Rabat is no longer a waterfall deduction — it's an informational line
  // below „Do zapłaty". So Łącznie = Suma prac (po rabacie) + Materiały, and Łącznie − Wpłaty =
  // „Do zapłaty" holds without a rabat step.
  const { combined } = computeSummarySplit(laborCostsNetFromKosztorys, materialsGross, vatRate)
  const { net: showNet, gross: showGross } = axisShows(moneyAxis)
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = clientView ? false : priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showRabat =
    rabatAmount > 0 ||
    (reconVisible && (reconciliation.rabat.actual > 0 || reconciliation.rabat.mismatch))
  const sumaPrac = summaryLine(laborCostsNetFromKosztorys, combined.net, vatRate)
  // Rabat is now an informational line (below „Do zapłaty"), not a deduction. It lives on the prace
  // plane and grosses — brutto = rabat×(1+VAT) — so both axes read a real figure.
  const rabat = moneyPair(rabatAmount, vatRate)
  const wplaty = faceValue(wplatyNet)

  const moneyCols = summaryMoneyCols(moneyAxis)

  return (
    <div className="text-foreground flex flex-col items-start gap-x-12 gap-y-8 text-sm">
      <div className="flex w-fit flex-col gap-4">
        <SummaryBreakdownTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          showNet={showNet}
          showGross={showGross}
          sumaPrac={sumaPrac}
          sumaPracMismatch={
            reconVisible && reconciliation.laborCosts.mismatch
              ? mismatchTooltip(reconciliation.laborCosts, 'Transakcje robocizny')
              : undefined
          }
          materialyBreakdown={materialyBreakdown}
          combinedNet={combined.net}
          combined={combined}
          vatRate={vatRate}
          investmentId={investmentId}
          clientView={clientView}
        />
        <SummaryTotalsTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          wplaty={wplaty}
          doZaplaty={doZaplaty}
          investmentId={investmentId}
          clientView={clientView}
        />
        {/* Informational only — Suma prac is already net of rabat, so this is NOT a deduction
            step. Its own segment keeps it out of the Wpłaty → Do zapłaty arithmetic. */}
        {showRabat && (
          <SummaryTable cols={moneyCols} className="w-fit">
            <SummaryRow
              label="Udzielono rabatu na łączną kwotę"
              line={rabat}
              axis={moneyAxis}
              mismatch={
                reconVisible && reconciliation.rabat.mismatch
                  ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
                  : undefined
              }
            />
          </SummaryTable>
        )}
      </div>
      {/* <div className="flex flex-wrap items-start gap-x-12 gap-y-8"> */}
      {/* <SectionSharePie subtotals={sectionSubtotals} /> */}
      {/* <CostStructurePie sumaPracNet={sumaPracNet} materialyBreakdown={materialyBreakdown} /> */}
      {/* </div> */}
    </div>
  )
}
