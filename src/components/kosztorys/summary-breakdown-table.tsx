'use client'

import Link from 'next/link'
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
import { type MutedAxisT } from '@/components/kosztorys/summary-axis'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// The upper grid: „Suma prac wykonanych" + each materiały/korekta line, summing to „Łącznie".
// This is the sheet Podsumowanie split; the waterfall below deducts from its Łącznie. The udział
// figures stay computed upstream (summaryLine share) — they feed the charts, just not this table.
export function SummaryBreakdownTable({
  cols,
  moneyAxis,
  sumaPrac,
  sumaPracMismatch,
  materialyBreakdown,
  combinedNet,
  combined,
  vatRate,
  mutedAxis,
  deriveMaterialsNet,
  investmentId,
  clientView,
}: {
  cols: string
  moneyAxis: MoneyAxisT
  sumaPrac: SummaryLineT
  sumaPracMismatch?: string
  materialyBreakdown: MaterialyBreakdownRowT[]
  combinedNet: number
  combined: MoneyPairT
  vatRate: number
  mutedAxis?: MutedAxisT
  // Price each materiały row netto as brutto − VAT (summaryLineGross) or at raw brutto (summaryLineFace).
  deriveMaterialsNet: boolean
  investmentId: number
  clientView: boolean
}) {
  return (
    <SummaryTable cols={cols}>
      <SummaryHeaderCell variant="label">Podsumowanie</SummaryHeaderCell>
      <SummaryMoneyHeaders axis={moneyAxis} mutedAxis={mutedAxis} />
      <SummaryRow
        label="Robocizna"
        line={sumaPrac}
        axis={moneyAxis}
        mutedAxis={mutedAxis}
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
            // `item.net` is the materiały BRUTTO transaction sum (financials-layer field name kept;
            // rename deferred to the persistence slice) — reinterpreted here as gross. When netto
            // pricing is off, the brutto figure stands on both axes (face value).
            line={
              deriveMaterialsNet
                ? summaryLineGross(item.net, combinedNet, vatRate)
                : summaryLineFace(item.net, combinedNet)
            }
            axis={moneyAxis}
            mutedAxis={mutedAxis}
          />
        ))}
      <SummaryRow
        label="Łącznie"
        line={combined}
        axis={moneyAxis}
        mutedAxis={mutedAxis}
        emphasize
      />
    </SummaryTable>
  )
}
