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

// The wpłaty list — same CSS-grid table as the Podsumowanie block above it (SummaryTable +
// SummaryLabelCell/SummaryValueCell). Deposits are rare, so no virtualization: one row each,
// date-desc.
//
// A wpłata prints only the kwoty it actually has (owner, 2026-08-23): gotówka is one kwota netto and
// its brutto cell reads „×", a przelew carries both off the faktura. Nothing is derived at VAT, so
// the two columns are independent sums and neither cross-checks the other — which is why the list
// carries NO „Razem" row (owner, 2026-08-23). A bold pair at the foot of two columns that no longer
// relate invites reading it as one figure crossed at VAT, and it is not: the brutto side counts only
// przelewy. What a total there is worth, it is worth per forma — the table below.
//
// The tag names the tor, not the plane: „Gotówka"/„Przelew" where the columns beside it already say
// netto and brutto, so one word never has to mean two things on one screen. „Nie określono" counts
// as gotówka (owner's „brak wartości = netto" ruling, 2026-07-23) but keeps saying so — it was never
// typed, and reading it back as a fact would hide the wpłaty that still need re-booking.
const planeLabel = (plane: DepositTransactionRowT['vatPlane']) =>
  plane == null ? 'Nie określono' : DEPOSIT_PLANE_LABELS[plane]

// „×", not „0,00": a wpłata netto has no brutto kwota at all, where a zero would read as a payment
// worth nothing.
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
  // The rows the settlement warning is about, marked where the reader can act on them. Owner-only,
  // like the warning itself: a client can't retag a wpłata and shouldn't be shown the doubt.
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
  // Tryb mieszany is the one where the two formy coexist by design, so it is the one that owes a
  // split (owner, 2026-08-20). A table of its own, below the list: interleaved with the wpłaty it
  // doubled every złoty. Each bucket sums the rows it names — the gotówka one carrying „×" in brutto
  // exactly like its rows — so here „Razem" is the sum of what stands directly above it, not of a
  // list whose two columns never met. Netto only; see the row itself.
  // Silent when one bucket is empty: a subtotal equal to „Razem" is a row that says nothing twice.
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

          {/* Netto only. Brutto has one contributor — przelewy — so a „Razem" there would restate
              the row directly above it in bold, and the bolding is what would make the reader take
              it for the whole set. Netto is the sum that actually adds two buckets together, and it
              is the plane tryb mieszany settles on. */}
          <SummaryLabelCell weight="bold">Razem</SummaryLabelCell>
          <SummaryValueCell weight="bold">{formatNet(totals.net)}</SummaryValueCell>
          <SummaryValueCell>{''}</SummaryValueCell>
        </SummaryTable>
      )}
    </div>
  )
}
