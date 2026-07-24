'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { MaterialyBreakdownRowT } from '@/types/investment-financials'

// The per-category „Wydatki inwestycyjne" split — each expense category's recorded brutto. When a
// netto reduction is active it adds the netto-after-reduction and the zł Różnica columns so the
// reduction's per-category effect is legible; otherwise it's a plain brutto-per-category table.
// `row.net` is the brutto sum (financials-layer field name kept; reinterpreted as gross here).
export function MaterialsBreakdownTable({
  rows,
  reduction,
  showReduction = false,
}: {
  rows: MaterialyBreakdownRowT[]
  // Fraction knocked off brutto to reach netto: netto = brutto × (1 − reduction).
  reduction: number
  // Show the Netto + Różnica columns (the reduction detail); off = brutto-only category split.
  showReduction?: boolean
}) {
  const shown = rows.filter((row) => row.net !== 0)
  if (shown.length === 0) return null

  const cols = showReduction
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  const netOf = (gross: number) => gross * (1 - reduction)
  const totalGross = shown.reduce((sum, row) => sum + row.net, 0)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Wydatki inwestycyjne</SummaryHeaderCell>
      <SummaryHeaderCell>{showReduction ? 'Brutto' : 'Kwota brutto'}</SummaryHeaderCell>
      {showReduction && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      {showReduction && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {shown.map((row) => (
        <Fragment key={row.id ?? 'korekta'}>
          <SummaryLabelCell>{row.label}</SummaryLabelCell>
          <SummaryValueCell>{formatNet(row.net)}</SummaryValueCell>
          {showReduction && <SummaryValueCell>{formatNet(netOf(row.net))}</SummaryValueCell>}
          {showReduction && (
            <SummaryValueCell className="text-muted-foreground">
              −{formatNet(row.net - netOf(row.net))}
            </SummaryValueCell>
          )}
        </Fragment>
      ))}
      <SummaryLabelCell className="font-bold">Razem</SummaryLabelCell>
      <SummaryValueCell className="font-bold">{formatNet(totalGross)}</SummaryValueCell>
      {showReduction && (
        <SummaryValueCell className="font-bold">{formatNet(netOf(totalGross))}</SummaryValueCell>
      )}
      {showReduction && (
        <SummaryValueCell className="text-muted-foreground font-bold">
          −{formatNet(totalGross - netOf(totalGross))}
        </SummaryValueCell>
      )}
    </SummaryTable>
  )
}
