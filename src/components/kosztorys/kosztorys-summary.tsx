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
import { SUMMARY_VALUE_COL, summaryMoneyCols } from '@/components/kosztorys/summary-grid'
import { DepositsTable } from '@/components/kosztorys/deposits-table'
import { SummaryBreakdownTable } from '@/components/kosztorys/summary-breakdown-table'
import { SummaryTotalsTable } from '@/components/kosztorys/summary-totals-table'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'
import type { SectionSliceInputT } from '@/lib/kosztorys/chart-slices'
import type { DepositTransactionRowT } from '@/types/reference-data'

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
  // Materiały netto — live server sum of the investment's unsettled transactions.
  materialyNet: number
  // Per-expense-category split of materialyNet (v1 parity); Σ === materialyNet.
  materialyBreakdown: MaterialyBreakdownRowT[]
  // Client-priced, view-invariant per-section subtotals — the section pie's structure source.
  sectionSubtotals: SectionSliceInputT[]
  // Wpłaty netto — the investor's deposits on this investment (totalIncome); subtracted from
  // Łącznie to reach „Do zapłaty". Matches the investment page's „Wpłaty" by construction.
  wplatyNet: number
  // The investment's individual deposit rows — the wpłaty list under the summary. Sortable, same
  // DataTable primitive as the subcontractor wypłaty list.
  depositTransactions: DepositTransactionRowT[]
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
// Robocizna) merged with the sheet Podsumowanie split (Robocizna / Materiały / Łącznie, udział %
// of Łącznie), then Wpłaty subtracted to reach „Do zapłaty" — one grid, no separate totals bar.
export function KosztorysSummary({
  investmentId,
  laborCostsNetFromKosztorys,
  doZaplaty,
  materialyNet,
  materialyBreakdown,
  sectionSubtotals,
  wplatyNet,
  depositTransactions,
  rabatAmount,
  reconciliation,
  priceView,
  vatRate,
  moneyAxis,
  clientView = false,
}: PropsT) {
  // Łącznie is the pre-rabat total (Suma prac + Materiały), so the rows above it reconcile to it;
  // Rabat then deducts from Łącznie down to „Do zapłaty" as its own waterfall line below.
  // laborCostsNetFromKosztorys arrives already net of rabat, so add it back for the Łącznie/udział base.
  const sumaPracNet = laborCostsNetFromKosztorys + rabatAmount
  const { combined } = computeSummarySplit(sumaPracNet, materialyNet, vatRate)
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
  const sumaPrac = summaryLine(sumaPracNet, combined.net, vatRate)
  // Rabat is an obniżka of prace, so it lives on the prace plane and grosses — brutto = rabat×(1+VAT).
  // Grossing it keeps the brutto waterfall exact: Łącznie − rabat − wpłaty = Do zapłaty on both axes
  // (toGross is linear). Wpłaty stays face value — it's a cash deposit, not prace.
  const rabat = moneyPair(rabatAmount, vatRate)
  const wplaty = faceValue(wplatyNet)

  const moneyCols = summaryMoneyCols(moneyAxis)
  const breakdownCols = `${moneyCols} ${SUMMARY_VALUE_COL}`

  return (
    <div className="text-foreground flex flex-col items-start gap-x-12 gap-y-8 px-4 pt-2 pb-10 text-sm">
      <div className="flex w-fit flex-col gap-4">
        <SummaryBreakdownTable
          cols={breakdownCols}
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
          investmentId={investmentId}
          clientView={clientView}
        />
        <SummaryTotalsTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          showRabat={showRabat}
          rabat={rabat}
          rabatMismatch={
            reconVisible && reconciliation.rabat.mismatch
              ? mismatchTooltip(reconciliation.rabat, 'Transakcje rabatu')
              : undefined
          }
          wplaty={wplaty}
          doZaplaty={doZaplaty}
          investmentId={investmentId}
          clientView={clientView}
        />
      </div>
      {depositTransactions.length > 0 && (
        <DepositsTable
          investmentId={investmentId}
          rows={depositTransactions}
          clientView={clientView}
        />
      )}
      {/* <div className="flex flex-wrap items-start gap-x-12 gap-y-8"> */}
      {/* <SectionSharePie subtotals={sectionSubtotals} /> */}
      {/* <CostStructurePie sumaPracNet={sumaPracNet} materialyBreakdown={materialyBreakdown} /> */}
      {/* </div> */}
    </div>
  )
}
