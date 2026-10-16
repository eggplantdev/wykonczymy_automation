'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { DEPOSIT_PLANE_LABELS, DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { formatPLDate } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { formatNet } from '@/lib/kosztorys/format'
import {
  depositRowPair,
  isGross,
  sumDeposits,
  type DepositPairT,
} from '@/lib/kosztorys/deposit-planes'
import { isOffPlaneDeposit } from '@/lib/kosztorys/off-plane-deposits'
import type { SettlementModeT } from '@/lib/kosztorys/settlement-mode'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { DepositTransactionRowT } from '@/types/transfers'

// „Nie określono" counts as gotówka but keeps saying so — reading it back as a fact would hide the
// wpłaty that still need re-booking.
const planeLabel = (plane: DepositTransactionRowT['vatPlane']) =>
  plane == null ? 'Nie określono' : DEPOSIT_PLANE_LABELS[plane]

// a wpłata netto has no brutto kwota at all, where a zero would read as a payment worth nothing.
const NOT_APPLICABLE = '×'
const money = (amount: number | null) => (amount == null ? NOT_APPLICABLE : formatNet(amount))

export function DepositsTable({
  investmentId,
  rows,
  preview,
  settlementMode,
}: {
  investmentId: number
  rows: DepositTransactionRowT[]
  preview: boolean
  settlementMode: SettlementModeT
}) {
  const flagsOffPlane = !preview
  const dateCell = (row: DepositTransactionRowT) => (
    <SummaryLabelCell className="tabular-nums">
      {preview ? (
        formatPLDate(row.date)
      ) : (
        <Link
          href={investmentTransfersHref(investmentId, { types: DEPOSIT_TYPES, id: row.id })}
          className="hover:underline"
        >
          {formatPLDate(row.date)}
        </Link>
      )}
    </SummaryLabelCell>
  )

  const totals = sumDeposits(rows)
  const netRows = rows.filter((row) => !isGross(row))
  const grossRows = rows.filter(isGross)
  const showPlaneSubtotals =
    settlementMode === 'MIXED' && netRows.length > 0 && grossRows.length > 0
  const planeSubtotals: { label: string; pair: DepositPairT }[] = [
    { label: 'Wpłaty gotówką', pair: { net: sumDeposits(netRows).net, gross: null } },
    { label: 'Wpłaty przelewem', pair: sumDeposits(grossRows) },
  ]
  const cols = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_LABEL_COL}`
  const subtotalCols = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`

  return (
    <div className="flex flex-col gap-6">
      <SummaryTable cols={cols} className="w-fit">
        <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
        <SummaryHeaderCell>Netto</SummaryHeaderCell>
        <SummaryHeaderCell>Brutto</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Forma wpłaty</SummaryHeaderCell>

        {rows.map((row) => {
          const pair = depositRowPair(row)
          const tone =
            flagsOffPlane && isOffPlaneDeposit(row, settlementMode) ? ('error' as const) : undefined
          return (
            <Fragment key={row.id}>
              {dateCell(row)}
              <SummaryValueCell tone={tone}>{formatNet(pair.net)}</SummaryValueCell>
              <SummaryValueCell tone={tone}>{money(pair.gross)}</SummaryValueCell>
              <SummaryLabelCell tone={tone}>{planeLabel(row.vatPlane)}</SummaryLabelCell>
            </Fragment>
          )
        })}
      </SummaryTable>

      {showPlaneSubtotals && (
        <SummaryTable cols={subtotalCols} className="w-fit">
          <SummaryHeaderCell variant="label">Wpłaty wg formy</SummaryHeaderCell>
          <SummaryHeaderCell>Netto</SummaryHeaderCell>
          <SummaryHeaderCell>Brutto</SummaryHeaderCell>

          {planeSubtotals.map(({ label, pair }) => (
            <Fragment key={label}>
              <SummaryLabelCell>{label}</SummaryLabelCell>
              <SummaryValueCell>{formatNet(pair.net)}</SummaryValueCell>
              <SummaryValueCell>{money(pair.gross)}</SummaryValueCell>
            </Fragment>
          ))}

          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold">{formatNet(totals.net)}</SummaryValueCell>
          <SummaryValueCell>{''}</SummaryValueCell>
        </SummaryTable>
      )}
    </div>
  )
}
