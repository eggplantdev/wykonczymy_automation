'use client'

import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { formatNet } from '@/lib/kosztorys/format'
import { formatPLDate } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { UNASSIGNED_WORKER_NAME } from '@/lib/kosztorys/payouts-by-worker'
import { workerKey } from '@/lib/kosztorys/worker-key'
import type { PayoutTransactionRowT, SubcontractorPayoutRowT } from '@/types/transfers'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

type PayoutTableRowT = {
  workerId: number | null
  workerName: string
  date: string
  amount: number
  description: string | null
}

const PAYOUT_COLUMNS: ColumnDef<PayoutTableRowT>[] = [
  {
    accessorKey: 'date',
    header: 'Data',
    cell: ({ getValue }) => formatPLDate(getValue<string>()),
  },
  { accessorKey: 'workerName', header: 'Pracownik' },
  {
    accessorKey: 'description',
    header: 'Opis',
    enableSorting: false,
    cell: ({ getValue }) => getValue<string | null>() || EMPTY_VALUE,
  },
  {
    accessorKey: 'amount',
    header: 'Kwota',
    cell: ({ getValue }) => (
      <span className="text-chart-green">{formatNet(getValue<number>())}</span>
    ),
  },
]

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
      containerClassName="max-h-100"
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
