'use client'

import { Fragment } from 'react'
import { formatNet } from '@/lib/kosztorys/format'
import { breakdownRowPair } from '@/lib/kosztorys/summary-economics'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { MaterialsBreakdownRowT } from '@/types/investment-financials'

// The per-category „Wydatki inwestycyjne" split — each expense category's recorded brutto, plus a
// separate frozen „… netto" row per category billed at netto. A non-null `netRate` adds the netto and
// zł Różnica columns; null keeps it a single-amount-per-category table.
// `row.net` is the brutto sum (financials-layer field name kept; reinterpreted as gross here).
export function MaterialsBreakdownTable({
  rows,
  netRate,
  caption = 'Wydatki inwestycyjne',
}: {
  rows: MaterialsBreakdownRowT[]
  // The rate the Netto column strips, as a fraction — the saved materiały rate, and nothing else.
  // null means materiały settle brutto: the investor is billed the receipt, so a netto column would
  // print an amount nobody owes. That is also how the company-plane („Rozliczone R+M") split renders.
  netRate: number | null
  // Names the split — the same per-category shape also renders the settled („wliczone w robociznę")
  // spend, which must never read as part of the investor's wydatki.
  caption?: string
}) {
  // No filter here: it would make the table disagree with the `rows.length` its callers gate on,
  // which is how the tab once rendered blank. The builders drop the zeros.
  if (rows.length === 0) return null

  const showNet = netRate != null
  const cols = showNet
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  const pairOf = (row: MaterialsBreakdownRowT) => breakdownRowPair(row, netRate)
  const totalGross = rows.reduce((sum, row) => sum + pairOf(row).gross, 0)
  const totalNet = rows.reduce((sum, row) => sum + pairOf(row).net, 0)

  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">{caption}</SummaryHeaderCell>
      {/* „Netto" bare, not „bez VAT": a brutto row crosses at the saved materiały rate, not at VAT,
            and a „… netto" row crosses at nothing — both its amounts are the invoice's. It leads
            because it is the figure the investor is billed. */}
      {showNet && <SummaryHeaderCell>Netto</SummaryHeaderCell>}
      {/* „Kwota", not „Brutto", where materiały settle brutto: with no rate to cross, there is only
            one plane, and naming it invites the reader to look for a netto twin that isn't there. */}
      <SummaryHeaderCell>{showNet ? 'Brutto' : 'Kwota'}</SummaryHeaderCell>
      {showNet && <SummaryHeaderCell>Różnica</SummaryHeaderCell>}
      {rows.map((row) => {
        const pair = pairOf(row)
        return (
          <Fragment key={`${row.origin}-${row.id ?? 'correction'}`}>
            <SummaryLabelCell>{row.label}</SummaryLabelCell>
            {showNet && <SummaryValueCell>{formatNet(pair.net)}</SummaryValueCell>}
            <SummaryValueCell>{formatNet(pair.gross)}</SummaryValueCell>
            {showNet && (
              <SummaryValueCell className="text-muted-foreground">
                {formatNet(pair.net - pair.gross)}
              </SummaryValueCell>
            )}
          </Fragment>
        )
      })}
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
