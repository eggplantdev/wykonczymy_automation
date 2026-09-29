'use client'

import {
  combinedPair,
  moneyPair,
  laborCostsNetPreDiscount,
  type MoneyPairT,
} from '@/lib/kosztorys/summary-economics'
import { formatNet } from '@/lib/kosztorys/format'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import type { PriceViewT } from '@/lib/kosztorys/calc'
import { summaryMoneyCols } from '@/components/kosztorys/summary/grid/summary-axis'
import { SummaryBreakdownTable } from '@/components/kosztorys/summary/tables/summary-breakdown-table'
import { SummaryTotalsTable } from '@/components/kosztorys/summary/tables/summary-totals-table'
import type { SettlementGroupT } from '@/components/kosztorys/summary/model/settlement-groups'
import {
  reconciliationTooltip,
  type KosztorysReconciliationT,
  type ReconT,
} from '@/lib/kosztorys/reconciliation'

// The scream's tooltip names both compared figures + the różnica; formatNet because this surface shows
// kosztorys nets. Shared copy with the investment page (reconciliationTooltip).
const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie) — client-side, reacts to unsaved edits.
  laborCostsNet: number
  // What the investor is billed for materiały. One figure standing on both planes: VAT never touches
  // materiały, only the investment's own stawka materiałów does, and that is applied upstream.
  materialsPair: MoneyPairT
  // Which money columns the tryb rozliczenia shows.
  moneyAxis: MoneyAxisT
  settlementGroups: SettlementGroupT[]
  // The rabat actually taken off the executed robocizna (net zł): the global discount when active,
  // else Σ per-item rabat. Unified upstream so this table shows one explicit „Rabat" line. 0 = none.
  discountAmount: number
  // Robocizna/rabat reconciliation verdict — the mismatch scream renders off this. Always supplied
  // (the body computes it unconditionally); preview suppresses the scream via reconVisible, not by
  // withholding the verdict.
  reconciliation: KosztorysReconciliationT
  // Active price view. The verdict compares client-view nets, so the scream only reads correctly in
  // 'client'; a subcontractor view reprices the displayed figure, so the scream is suppressed there.
  priceView: PriceViewT
  vatRate: number
  // Read-only client render: the mismatch scream is an owner-internal signal (a client's view is
  // always 'client', which is exactly when the scream would fire), and the internal drill-down links
  // point at owner-only pages — so gate the scream off and render those labels as plain text.
  preview?: boolean
}

// The bottom summary block, in two tables that answer two different questions. The first builds the
// debt — Robocizna przed rabatem, the Rabat, materiały, then Łącznie. Below it, the settlement, where
// wpłaty pay that Łącznie down to what is left to pay.
export function SettlementSummary({
  investmentId,
  laborCostsNet,
  materialsPair,
  moneyAxis,
  settlementGroups,
  discountAmount,
  reconciliation,
  priceView,
  vatRate,
  preview = false,
}: PropsT) {
  // The scream compares client-view nets; a subcontractor view reprices the displayed figure, so the
  // scream would sit next to a number it isn't comparing. Show it only in the client view.
  const reconVisible = !preview && priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch — otherwise the one gap population most needs to catch stays invisible.
  // Only while the scream is visible; otherwise the row follows the normal „rabat > 0" rule.
  const showDiscount =
    discountAmount > 0 ||
    (reconVisible && (reconciliation.discount.actual > 0 || reconciliation.discount.mismatch))
  const laborCostsPair = moneyPair(laborCostsNetPreDiscount(laborCostsNet, discountAmount), vatRate)
  // Rabat lives on the prace plane and grosses — brutto = rabat×(1+VAT) — so both axes read a real
  // figure. It renders negative: it is a deduction step, and a positive figure in a subtracted row
  // reads as if it were being added.
  const discount = moneyPair(-discountAmount, vatRate)
  const combined = combinedPair(laborCostsNet, materialsPair, vatRate)

  const moneyCols = summaryMoneyCols(moneyAxis)

  return (
    <div className="text-foreground flex flex-col items-start gap-x-12 gap-y-8 text-sm">
      <div className="flex w-fit flex-col gap-8">
        <SummaryBreakdownTable
          cols={moneyCols}
          moneyAxis={moneyAxis}
          laborCostsPair={laborCostsPair}
          laborCostsMismatch={
            reconVisible && reconciliation.laborCosts.mismatch
              ? mismatchTooltip(reconciliation.laborCosts, 'Transakcje robocizny')
              : undefined
          }
          discount={showDiscount ? discount : undefined}
          materialsPair={materialsPair}
          combined={combined}
          discountMismatch={
            reconVisible && reconciliation.discount.mismatch
              ? mismatchTooltip(reconciliation.discount, 'Transakcje rabatu')
              : undefined
          }
        />
        {settlementGroups.map((group, index) => (
          <SummaryTotalsTable
            key={group.caption ?? index}
            cols={moneyCols}
            caption={group.caption}
            axis={group.axis}
            rows={group.rows}
            investmentId={investmentId}
            preview={preview}
          />
        ))}
      </div>
    </div>
  )
}
