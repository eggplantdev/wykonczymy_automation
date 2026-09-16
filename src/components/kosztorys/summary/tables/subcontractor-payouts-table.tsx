'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { UNASSIGNED_WORKER_NAME } from '@/lib/kosztorys/payouts-by-worker'
import { workerKey } from '@/lib/kosztorys/worker-key'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/transfers'

// One flat row per wypłata for the virtualized DataTable — worker name resolved up front so the
// grid can sort on it without a per-cell lookup.
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

// Sized explicitly for the same reason as the wydatki list: a fixed-layout virtualized table falls
// back to a uniform 150 per unsized column.
const PAYOUT_COLUMNS: ColumnDef<PayoutTableRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    size: 96,
    cell: ({ getValue }) => (
      <span className="tabular-nums">{formatPLDate(getValue<string>())}</span>
    ),
  },
  { accessorKey: 'workerName', header: 'Pracownik', size: 200 },
  {
    accessorKey: 'description',
    header: 'Opis',
    size: 320,
    enableSorting: false,
    cell: ({ getValue }) => (
      <span className="text-muted-foreground">{getValue<string | null>() || '—'}</span>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Kwota',
    size: 140,
    meta: { align: 'right' },
    cell: ({ getValue }) => (
      <span className="text-chart-green tabular-nums">{formatNet(getValue<number>())}</span>
    ),
  },
]

// The un-summed wypłaty list under „Podsumowanie podwykonawców". Every column sorts, so the table
// only sets a date-desc opening order. Owner-only by construction (the subcontractor views are
// unreachable in the client preview), so the per-row links are always live.
export function SubcontractorPayoutsTable({
  investmentId,
  payouts,
  payoutTransactions,
}: {
  investmentId: number
  payouts: SubcontractorPayoutRowT[]
  payoutTransactions: PayoutTransactionRowT[]
}) {
  const nameByWorker = new Map(payouts.map((payout) => [workerKey(payout.workerId), payout.name]))

  const rows: PayoutTableRowT[] = payoutTransactions.map((tx) => ({
    workerId: tx.workerId,
    workerName: nameByWorker.get(workerKey(tx.workerId)) ?? UNASSIGNED_WORKER_NAME,
    date: tx.date,
    amount: tx.amount,
    description: tx.description,
  }))

  return (
    <DataTable
      data={rows}
      columns={PAYOUT_COLUMNS}
      enableVirtualization
      virtualRowHeight={ROW_HEIGHT}
      virtualContainerHeight={TABLE_HEIGHT}
      initialSorting={[{ id: 'date', desc: true }]}
      getRowHref={(row) =>
        row.workerId === null
          ? undefined
          : investmentTransfersHref(investmentId, {
              types: ['PAYOUT'],
              worker: row.workerId,
            })
      }
      className="mt-4 w-full"
    />
  )
}
