'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { DEPOSIT_TYPES, VAT_PLANE_LABELS } from '@/lib/constants/transfers'
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
// date-desc. „Netto/Brutto" is the deposit's vatPlane; legacy null defaults to „Brutto" (owner's
// „brak wartości = brutto" ruling).
export function DepositsTable({
  investmentId,
  rows,
  clientView,
  showPlane,
}: {
  investmentId: number
  rows: DepositTransactionRowT[]
  clientView: boolean
  // The per-deposit „Netto/Brutto" column — only meaningful in tryb mieszany, where the plane split
  // drives the reconciliation beside this table. Hidden in every other view.
  showPlane: boolean
}) {
  const cols = showPlane
    ? `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL} ${SUMMARY_VALUE_COL}`
    : `${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`
  return (
    <SummaryTable cols={cols} className="w-fit">
      <SummaryHeaderCell variant="label">Wpłaty</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>
      {showPlane && <SummaryHeaderCell>Netto/Brutto</SummaryHeaderCell>}

      {rows.map((row) => (
        <Fragment key={row.id}>
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
          <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green')}>
            {formatNet(row.amount)}
          </span>
          {showPlane && (
            <span className={cn(SUMMARY_VALUE_CELL, 'text-muted-foreground')}>
              {/* Honest blank for a deposit with no plane set — the reconciliation still counts it as
                  brutto (owner's „brak wartości = brutto" default), but the row itself doesn't claim
                  a value that wasn't recorded. */}
              {row.vatPlane ? VAT_PLANE_LABELS[row.vatPlane] : '—'}
            </span>
          )}
        </Fragment>
      ))}
    </SummaryTable>
  )
}
