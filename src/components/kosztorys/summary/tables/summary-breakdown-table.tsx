'use client'

import type { MoneyPairT } from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary/grid/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary/grid/summary-row'

export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  laborCostsPair,
  laborCostsMismatch,
  discount,
  discountMismatch,
  materialsPair,
  combined,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  laborCostsPair: MoneyPairT
  laborCostsMismatch?: string
  // Already negative, built by the caller (it owns the VAT rate).
  discount?: MoneyPairT
  discountMismatch?: string
  materialsPair: MoneyPairT
  combined: MoneyPairT
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      <SummaryRow
        label="Robocizna"
        line={laborCostsPair}
        axis={moneyAxis}
        mismatch={laborCostsMismatch}
      />
      {discount && (
        <SummaryRow
          label="Rabat"
          line={discount}
          axis={moneyAxis}
          mismatch={discountMismatch}
          discount
        />
      )}
      {materialsPair.gross !== 0 && (
        <SummaryRow label="Materiały" line={materialsPair} axis={moneyAxis} />
      )}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize />
    </SummaryTable>
  )
}
