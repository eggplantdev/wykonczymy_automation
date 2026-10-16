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

const mismatchTooltip = (recon: ReconT, subject: string) =>
  reconciliationTooltip(recon, subject, formatNet)

type PropsT = {
  investmentId: number
  // Robocizna wartość netto (po rabacie)
  laborCostsNet: number
  materialsPair: MoneyPairT
  moneyAxis: MoneyAxisT
  settlementGroups: SettlementGroupT[]
  discountAmount: number
  reconciliation: KosztorysReconciliationT
  priceView: PriceViewT
  vatRate: number
  preview?: boolean
}

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
  // scream would sit next to a number it isn't comparing.
  const reconVisible = !preview && priceView === 'client'
  // Force-show the „Rabat" row even at kosztorys-rabat 0, so a RABAT transfer with no kosztorys rabat
  // can't hide the mismatch.
  const showDiscount =
    discountAmount > 0 ||
    (reconVisible && (reconciliation.discount.actual > 0 || reconciliation.discount.mismatch))
  const laborCostsPair = moneyPair(laborCostsNetPreDiscount(laborCostsNet, discountAmount), vatRate)
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
          <div key={group.caption ?? index} className="flex flex-col gap-2">
            <SummaryTotalsTable
              cols={moneyCols}
              caption={group.caption}
              axis={group.axis}
              rows={group.rows}
              investmentId={investmentId}
              preview={preview}
            />
            {group.footnote && <p className="text-muted-foreground text-xs">{group.footnote}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
