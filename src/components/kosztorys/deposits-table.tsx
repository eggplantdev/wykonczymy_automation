'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { DEPOSIT_TYPES } from '@/lib/constants/transfers'
import { formatPLDate } from '@/lib/utils/format-date'
import { formatNet } from '@/lib/kosztorys/format'
import {
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryLabelCell,
  SummaryTable,
  SummaryValueCell,
} from '@/components/ui/summary-grid'
import type { DepositTransactionRowT } from '@/types/reference-data'

// The wpłaty list — same CSS-grid table as the Podsumowanie block above it (SummaryTable +
// SummaryLabelCell/SummaryValueCell). Deposits are rare, so no virtualization: one row each,
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
    <SummaryLabelCell className="tabular-nums">
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
    </SummaryLabelCell>
  )

  const total = rows.reduce((sum, row) => sum + row.amount, 0)

  // List rows and the Razem total live in ONE grid so the whole wpłaty block reads as a single
  // segment — the gap-px separator between the last wpłata and the first Razem row is just another
  // rowline, no break.
  if (!showPlane) {
    return (
      <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
        <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>
        {rows.map((row) => (
          <Fragment key={row.id}>
            {dateCell(row)}
            <SummaryValueCell className="text-chart-green">
              {formatNet(row.amount)}
            </SummaryValueCell>
          </Fragment>
        ))}
        <SummaryLabelCell className="font-bold">Razem</SummaryLabelCell>
        <SummaryValueCell className="text-chart-green font-bold">
          {formatNet(total)}
        </SummaryValueCell>
      </SummaryTable>
    )
  }

  // One Razem row per rodzaj — always all three, even a 0 zł bucket, so the split is fully readable.
  const perPlane = (['NET', 'GROSS', null] as const).map((plane) => ({
    plane,
    total: rows.reduce((sum, row) => (row.vatPlane === plane ? sum + row.amount : sum), 0),
  }))

  // Two grids stacked flush (`-mt-px` collapses the doubled border into one line) so the block reads
  // as one segment — but the Razem grid is only two columns wide, so it never paints an empty „Rodzaj"
  // cell (the rodzaj is already in each Razem label). Their shared first two tracks are fixed rem
  // widths, so Data/Kwota stay aligned across both.
  const listCols = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_LABEL_COL}`
  const totalCols = `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  return (
    <div className="flex w-fit flex-col">
      <SummaryTable cols={listCols} className="w-fit">
        <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
        <SummaryHeaderCell>Kwota</SummaryHeaderCell>
        <SummaryHeaderCell variant="label">Rozliczenie netto/brutto</SummaryHeaderCell>

        {rows.map((row) => (
          <Fragment key={row.id}>
            {dateCell(row)}
            <SummaryValueCell className="text-chart-green">
              {formatNet(row.amount)}
            </SummaryValueCell>
            <SummaryLabelCell>{planeLabel(row.vatPlane)}</SummaryLabelCell>
          </Fragment>
        ))}
      </SummaryTable>

      <SummaryTable cols={totalCols} className="-mt-px w-fit">
        {perPlane.map((bucket) => (
          <Fragment key={bucket.plane ?? 'null'}>
            <SummaryLabelCell className="font-bold">
              Razem {planeLabel(bucket.plane).toLowerCase()}
            </SummaryLabelCell>
            <SummaryValueCell className="text-chart-green font-bold">
              {formatNet(bucket.total)}
            </SummaryValueCell>
          </Fragment>
        ))}
      </SummaryTable>
    </div>
  )
}
