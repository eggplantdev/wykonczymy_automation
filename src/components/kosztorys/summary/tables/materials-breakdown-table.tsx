'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { categoryBreakdownRows, pricedBreakdownRows } from '@/lib/kosztorys/breakdown-rows'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryCell,
  SummaryTable,
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
      <SummaryHeaderCell>{caption}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      <SummaryHeaderCell>{showNet ? 'Brutto' : 'Kwota'}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {priced.map(({ key, label, pair }) => (
        <Fragment key={key}>
          <SummaryCell>{label}</SummaryCell>
          {showNet && <SummaryCell>{formatNet(pair.net)}</SummaryCell>}
          <SummaryCell>{formatNet(pair.gross)}</SummaryCell>
          {showNet && (
            <SummaryCell className="text-muted-foreground">
              {formatNet(pair.net - pair.gross)}
            </SummaryCell>
          )}
        </Fragment>
      ))}
      <SummaryCell weight="bold">Razem</SummaryCell>
      {showNet && <SummaryCell weight="bold">{formatNet(totalNet)}</SummaryCell>}
      <SummaryCell weight="bold">{formatNet(totalGross)}</SummaryCell>
      {showNet && (
        <SummaryCell weight="bold" className="text-muted-foreground">
          {formatNet(totalNet - totalGross)}
        </SummaryCell>
      )}
    </SummaryTable>
  )
}
