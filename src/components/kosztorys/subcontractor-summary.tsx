'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/ui/data-table/data-table'
import { ToggleGroup, type OptionT } from '@/components/ui/toggle-group'
import {
  SUMMARY_LABEL_CELL,
  SUMMARY_LABEL_COL,
  SUMMARY_VALUE_CELL,
  SUMMARY_VALUE_COL,
  SummaryHeaderCell,
  SummaryTable,
} from '@/components/kosztorys/summary-grid'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import {
  computeSubcontractorSummary,
  UNASSIGNED_WORKER_NAME,
} from '@/lib/kosztorys/subcontractor-summary'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/reference-data'
import { cn } from '@/lib/utils/cn'

type PropsT = {
  investmentId: number
  // „Suma wykonanej pracy" (należne) — executed value at the active view's subcontractor price, pre-rabat.
  dueNet: number
  // Realized PAYOUTs per worker (null-worker bucket kept), name-enriched at the page.
  payouts: SubcontractorPayoutRowT[]
  // The un-summed PAYOUT rows, already date-desc from the query. Feed the sortable/virtualized list.
  payoutTransactions: PayoutTransactionRowT[]
}

type GroupModeT = 'worker' | 'date'

const MODE_OPTIONS: OptionT<GroupModeT>[] = [
  { value: 'worker', label: 'Wg pracownika' },
  { value: 'date', label: 'Wg daty' },
]

const UNASSIGNED_KEY = 'unassigned'
const workerKey = (workerId: number | null) => (workerId === null ? UNASSIGNED_KEY : workerId)

// One flat row per wypłata for the virtualized DataTable — worker name resolved up front so the
// grid can sort on it without a per-cell lookup. `amount` is the stored (positive) expense; the
// Kwota cell negates it for display (money leaving the company).
type PayoutTableRowT = {
  workerId: number | null
  workerName: string
  date: string
  amount: number
  description: string | null
}

// Fixed height for the virtualizer's scroll container (it needs px, not a flex track). Kept short
// enough that the headline + totals block above it stay visible inside the collapsible panel.
const TABLE_HEIGHT = 400
const ROW_HEIGHT = 36

const PAYOUT_COLUMNS: ColumnDef<PayoutTableRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPLDate(getValue<string>())}</span>
    ),
  },
  { accessorKey: 'workerName', header: 'Pracownik' },
  {
    accessorKey: 'description',
    header: 'Opis',
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() || '—'}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Kwota',
    meta: { align: 'right' },
    cell: ({ getValue }) => (
      <span className="text-chart-green tabular-nums">{formatNet(-getValue<number>())}</span>
    ),
  },
]

// The subcontractor-plane footer, shown in the Z narzędziami / Bez narzędzi views in place of the
// client Podsumowanie. One „Kwota" column throughout, no netto/brutto axis (EX-558: subcontractors
// are paid without VAT). Owner-only by construction — these views are unreachable in the client
// preview, so the per-worker links are always live (no plain-text fallback needed).
export function SubcontractorSummary({
  investmentId,
  dueNet,
  payouts,
  payoutTransactions,
}: PropsT) {
  const summary = computeSubcontractorSummary(dueNet, payouts)
  const nameByWorker = new Map(payouts.map((payout) => [workerKey(payout.workerId), payout.name]))
  const [mode, setMode] = useState<GroupModeT>('worker')

  const tableRows: PayoutTableRowT[] = payoutTransactions.map((tx) => ({
    workerId: tx.workerId,
    workerName: nameByWorker.get(workerKey(tx.workerId)) ?? UNASSIGNED_WORKER_NAME,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
  }))

  // The toggle is a sort preset — „Wg pracownika" groups by name, „Wg daty" is reverse-chronological.
  // Keying the DataTable on `mode` resets its internal sort to this preset; column-header clicks then
  // refine within the chosen mode.
  const initialSorting =
    mode === 'worker' ? [{ id: 'workerName', desc: false }] : [{ id: 'date', desc: true }]

  return (
    <div className="text-foreground flex w-full flex-col gap-y-4 px-4 pt-2 pb-6 text-sm">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <HeadlineSummary summary={summary} dueNet={dueNet} />
        {summary.rows.length > 0 && (
          <WorkerTotals investmentId={investmentId} rows={summary.rows} />
        )}
      </div>

      {payoutTransactions.length > 0 && (
        <div className="flex flex-col gap-y-2">
          <ToggleGroup
            options={MODE_OPTIONS}
            value={mode}
            onChange={setMode}
            aria-label="Grupowanie wypłat"
            className="w-fit"
          />
          <DataTable
            key={mode}
            data={tableRows}
            columns={PAYOUT_COLUMNS}
            enableVirtualization
            virtualRowHeight={ROW_HEIGHT}
            virtualContainerHeight={TABLE_HEIGHT}
            initialSorting={initialSorting}
            getRowHref={(row) =>
              row.workerId === null
                ? undefined
                : `/inwestycje/${investmentId}?type=PAYOUT&worker=${row.workerId}`
            }
            className="w-full max-w-5xl"
          />
        </div>
      )}
    </div>
  )
}

function HeadlineSummary({
  summary,
  dueNet,
}: {
  summary: ReturnType<typeof computeSubcontractorSummary>
  dueNet: number
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie podwykonawców</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      <span className={cn(SUMMARY_LABEL_CELL, 'font-medium')}>Suma wykonanej pracy</span>
      <span className={cn(SUMMARY_VALUE_CELL, 'font-medium')}>{formatNet(dueNet)}</span>

      <span className={cn(SUMMARY_LABEL_CELL, 'font-medium')}>Zaliczki (wypłaty) razem</span>
      <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green font-medium')}>
        {formatNet(-summary.payoutsTotal)}
      </span>

      {/* Pozostało do wypłaty = należne − zaliczki. Negative = the crew has been overpaid — an
          anomaly, so it reads red; a normal positive „still owed" stays neutral bold. */}
      <span className={cn(SUMMARY_LABEL_CELL, 'font-bold')}>Pozostało do wypłaty</span>
      <span
        className={cn(SUMMARY_VALUE_CELL, 'font-bold', summary.remaining < 0 && 'text-destructive')}
      >
        {formatNet(summary.remaining)}
      </span>
    </SummaryTable>
  )
}

function WorkerTotals({
  investmentId,
  rows,
}: {
  investmentId: number
  rows: ReturnType<typeof computeSubcontractorSummary>['rows']
}) {
  return (
    <SummaryTable cols={`${SUMMARY_LABEL_COL} ${SUMMARY_VALUE_COL}`} className="h-fit w-fit">
      <SummaryHeaderCell variant="label">Podsumowanie pracowników</SummaryHeaderCell>
      <SummaryHeaderCell>Kwota</SummaryHeaderCell>

      {rows.map((row) => (
        <div key={workerKey(row.workerId)} className="contents">
          <span className={cn(SUMMARY_LABEL_CELL, 'font-medium')}>
            {row.workerId === null ? (
              row.name
            ) : (
              <Link
                href={`/inwestycje/${investmentId}?type=PAYOUT&worker=${row.workerId}`}
                className="hover:underline"
              >
                {row.name}
              </Link>
            )}
          </span>
          <span className={cn(SUMMARY_VALUE_CELL, 'text-chart-green font-medium')}>
            {formatNet(-row.total)}
          </span>
        </div>
      ))}
    </SummaryTable>
  )
}
