'use client'

import Link from 'next/link'
import {
  summaryLineGross,
  type MoneyPairT,
  type SummaryLineT,
} from '@/lib/kosztorys/summary-economics'

// Materiały are recorded brutto; VAT is subtracted to reach netto — the inverse of robocizna, where
// netto is native. This hint marks that direction on every materiały row.
const MATERIALY_HINT =
  'Materiały rozliczane brutto — netto = brutto ÷ (1+VAT), VAT odejmujemy (odwrotnie niż przy robociźnie)'
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
  vatRate,
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
  vatRate: number
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
            // `item.net` is the materiały BRUTTO transaction sum (financials-layer field name kept;
            // rename deferred to the persistence slice) — reinterpreted here as gross.
            line={summaryLineGross(item.net, combinedNet, vatRate)}
            axis={moneyAxis}
            hint={MATERIALY_HINT}
          />
        ))}
      <SummaryRow label="Łącznie" line={combined} axis={moneyAxis} emphasize hideShare />
    </SummaryTable>
  )
}
