'use client'

import Link from 'next/link'
import {
  summaryLineFace,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'
import type { MoneyAxisT } from '@/lib/kosztorys/money-axis'
import { SummaryHeaderCell, SummaryRow, SummaryTable } from '@/components/kosztorys/summary-grid'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// The upper grid: „Suma prac wykonanych" + each materiały/korekta line, summing to „Łącznie" with a
// udział column. This is the sheet Podsumowanie split; the waterfall below deducts from its Łącznie.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  showNet,
  showGross,
  sumaPrac,
  sumaPracMismatch,
  materialyBreakdown,
  combinedNet,
  combined,
  investmentId,
  clientView,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  showNet: boolean
  showGross: boolean
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  materialyBreakdown: MaterialyBreakdownRowT[]
  combinedNet: number
  combined: MoneyPairT
  investmentId: number
  clientView: boolean
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      {showGross && <SummaryHeaderCell>Brutto</SummaryHeaderCell>}
      <SummaryHeaderCell>Udział</SummaryHeaderCell>
      <SummaryRow
        label="Suma prac wykonanych"
        line={sumaPrac}
        axis={moneyAxis}
        mismatch={sumaPracMismatch}
      />
      {materialyBreakdown
        .filter((item) => item.net !== 0)
        .map((item) => (
          <SummaryRow
            key={item.id ?? 'korekta'}
            label={
              item.id !== null && !clientView ? (
                <Link
                  href={`/inwestycje/${investmentId}?expenseCategory=${item.id}`}
                  className="hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                item.label
              )
            }
            line={summaryLineFace(item.net, combinedNet)}
            axis={moneyAxis}
            noBrutto
          />
        ))}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize hideShare />
    </SummaryTable>
  )
}
