'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { formatPLDate } from '@/lib/utils/format-date'
import { formatNet } from '@/lib/kosztorys/format'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/kosztorys/summary-grid'
import type { DepositTransactionRowT } from '@/types/reference-data'
import { cn } from '@/lib/utils/cn'

// The wpłaty list — same CSS-grid table as the Podsumowanie block above it (bg-border container +
// gap-px separators, SUMMARY_*_CELL cells). Deposits are rare, so no virtualization: one row each,
// date-desc.
//
// In tryb mieszany (`showPlane`) the table adds a „Rodzaj" column naming each wpłata's vatPlane —
// Netto (`NET`), Brutto (`GROSS`), or „Nie określono" (`null`) — and closes with a Razem row for
// each of the three rodzaje. The buckets are display-only: „Nie określono" still counts as netto in the
// settlement math (owner's „brak wartości = netto" ruling, 2026-07-23), noted under the „Rozliczenie
// mieszane" block. Outside cash mode the plane is irrelevant, so the table is a plain Data | Kwota list.
const PLANE_LABELS = { NET: 'Netto', GROSS: 'Brutto' } as const
const planeLabel = (plane: DepositTransactionRowT['vatPlane']) =>
  plane == null ? 'Nie określono' : PLANE_LABELS[plane]
export function DepositsTable({
  investmentId,
  rows,
  clientView,
  showPlane,
}: {
  investmentId: number
  rows: DepositTransactionRowT[]
  clientView: boolean
  showPlane: boolean
}) {
  const dateCell = (row: DepositTransactionRowT) => (
    <span className={cn(SUMMARY_LABEL_CELL, 'tabular-nums')}>
      {clientView ? (
        formatPLDate(row.date)
      ) : (
        <Link
          href={`/inwestycje/${investmentId}?type=${DEPOSIT_TYPES.join(',')}`}
          className="hover:underline"
        >
          {formatPLDate(row.date)}
        </Link>
      )}
    </span>
  )

  if (!showPlane) {
    return (
      <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
        <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>
        {rows.map((row) => (
          <Fragment key={row.id}>
            {dateCell(row)}
            <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green')}>
              {formatNet(row.amount)}
            </span>
          </Fragment>
        ))}
      </SummaryTable>
    )
  }

  // One Razem row per rodzaj — always all three, even a 0 zł bucket, so the split is fully readable.
  const perPlane = (['NET', 'GROSS', null] as const).map((plane) => ({
    plane,
    total: rows.reduce((sum, row) => (row.vatPlane === plane ? sum + row.amount : sum), 0),
  }))

  const cols = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_LABEL_COL}`
  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>
      <SummaryHeaderCell variant="label">Rodzaj</SummaryHeaderCell>

      {rows.map((row) => (
        <Fragment key={row.id}>
          {dateCell(row)}
          <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green')}>
            {formatNet(row.amount)}
          </span>
          <span className={SUMMARY_LABEL_CELL}>{planeLabel(row.vatPlane)}</span>
        </Fragment>
      ))}

      {perPlane.map((bucket) => (
        <Fragment key={bucket.plane ?? 'null'}>
          <span className={cn(SUMMARY_LABEL_CELL, 'font-bold')}>
            Razem {planeLabel(bucket.plane).toLowerCase()}
          </span>
          <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green font-bold')}>
            {formatNet(bucket.total)}
          </span>
          <span className={SUMMARY_LABEL_CELL} />
        </Fragment>
      ))}
    </SummaryTable>
  )
}
