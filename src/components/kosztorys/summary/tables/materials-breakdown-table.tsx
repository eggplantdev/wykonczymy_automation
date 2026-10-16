'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { categoryBreakdownRows, pricedBreakdownRows } from '@/lib/kosztorys/breakdown-rows'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

export function MaterialsBreakdownTable({
  rows,
  netRate,
  caption = 'Wydatki inwestycyjne',
  byCategory = false,
}: {
  rows: MaterialsBreakdownRowT[]
  // null means materiały settle brutto: the investor is billed the receipt, so a netto column would
  // print an amount nobody owes.
  netRate: number | null
  caption?: string
  byCategory?: boolean
}) {
  // No filter here: it would make the table disagree with the `rows.length` its callers gate on.
  if (rows.length === 0) return null

  const showNet = netRate != null
  const cols = showNet
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  const priced = byCategory
    ? categoryBreakdownRows(rows, netRate)
    : pricedBreakdownRows(rows, netRate)
  const totalGross = priced.reduce((sum, row) => sum + row.pair.gross, 0)
  const totalNet = priced.reduce((sum, row) => sum + row.pair.net, 0)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      <SummaryHeaderCell>{showNet ? 'Brutto' : 'Kwota'}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {priced.map(({ key, label, pair }) => (
        <Fragment key={key}>
          <SummaryLabelCell>{label}</SummaryLabelCell>
          {showNet && <SummaryValueCell>{formatNet(pair.net)}</SummaryValueCell>}
          <SummaryValueCell>{formatNet(pair.gross)}</SummaryValueCell>
          {showNet && (
            <SummaryValueCell className="text-muted-foreground">
              {formatNet(pair.net - pair.gross)}
            </SummaryValueCell>
          )}
        </Fragment>
      ))}
      <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
      {showNet && <SummaryValueCell weight="bold">{formatNet(totalNet)}</SummaryValueCell>}
      <SummaryValueCell weight="bold">{formatNet(totalGross)}</SummaryValueCell>
      {showNet && (
        <SummaryValueCell weight="bold" className="text-muted-foreground">
          {formatNet(totalNet - totalGross)}
        </SummaryValueCell>
      )}
    </SummaryTable>
  )
}
