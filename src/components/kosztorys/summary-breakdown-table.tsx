'use client'

import {
  summaryLineFace,
  summaryLineGross,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryTable } from '@/components/ui/summary-grid'
import { SummaryMoneyHeaders } from '@/components/kosztorys/summary-money-headers'
import { SummaryRow } from '@/components/kosztorys/summary-row'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// The upper grid: „Suma prac wykonanych" + „Materiały" (one aggregate line — the per-category split
// lives in the Wydatki view), summing to „Łącznie". This is the sheet Podsumowanie split; the
// waterfall below deducts from its Łącznie.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  sumaPrac,
  sumaPracMismatch,
  materialyBreakdown,
  combinedNet,
  combined,
  vatRate,
  deriveMaterialsNet,
  materialsReduction,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  materialyBreakdown: MaterialyBreakdownRowT[]
  combinedNet: number
  combined: MoneyPairT
  vatRate: number
  // Price materiały netto as brutto − VAT (summaryLineGross) or at raw brutto (summaryLineFace).
  deriveMaterialsNet: boolean
  // When set (and deriveMaterialsNet), netto = brutto × (1 − materialsReduction) instead of the
  // VAT-strip default (temporary client-side experiment).
  materialsReduction?: number
}) {
  // Σ over categories — `item.net` is each category's materiały BRUTTO sum (financials-layer field
  // name kept; reinterpreted as gross here). Per-item pricing is linear in the brutto amount, so the
  // aggregate line equals summing the per-category rows the Wydatki view still shows individually.
  const materialsGross = materialyBreakdown.reduce((sum, item) => sum + item.net, 0)
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} />
      <SummaryRow label="Robocizna" line={sumaPrac} axis={moneyAxis} mismatch={sumaPracMismatch} />
      {materialsGross !== 0 && (
        <SummaryRow
          label="Materiały"
          line={
            deriveMaterialsNet
              ? summaryLineGross(materialsGross, combinedNet, vatRate, materialsReduction)
              : summaryLineFace(materialsGross, combinedNet)
          }
          axis={moneyAxis}
        />
      )}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize />
    </SummaryTable>
  )
}
