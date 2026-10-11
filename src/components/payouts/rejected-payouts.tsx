'use client'

import { useState } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { SearchCheck } from 'lucide-react'
import { DataTable } from '@/components/tables/data-table/data-table'
import { RowActionButton } from '@/components/ui/row-actions/row-action-button'
import { VerifyRejectedPayoutDialog } from '@/components/payouts/verify-rejected-payout-dialog'
import type { RejectedPayoutT } from '@/lib/db/payout-confirmation'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'

const col = createColumnHelper<RejectedPayoutT>()

export function RejectedPayouts({ payouts }: { payouts: RejectedPayoutT[] }) {
  const [verifiedId, setVerifiedId] = useState<number>()
  // Looked up rather than held, so a cancellation that drops the row also closes the dialog.
  const verified = payouts.find((payout) => payout.id === verifiedId)

  if (payouts.length === 0) return null

  const columns = [
    col.accessor('date', { header: 'Data', cell: (info) => formatPLDate(info.getValue()) }),
    col.accessor('workerName', { header: 'Pracownik' }),
    col.accessor('amount', {
      header: 'Kwota',
      meta: { align: 'right' },
      cell: (info) => formatPLN(info.getValue()),
    }),
    col.accessor('investmentName', {
      header: 'Inwestycja',
      cell: (info) => info.getValue() ?? '—',
    }),
    col.accessor('rejectionReason', {
      header: 'Powód',
      cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
    }),
    col.accessor('decidedAt', {
      header: 'Odrzucona',
      cell: (info) => formatPLDateTime(info.getValue()),
    }),
    col.display({
      id: 'actions',
      header: 'Akcje',
      meta: { align: 'right' },
      cell: (info) => (
        <RowActionButton
          icon={SearchCheck}
          label={`Zweryfikuj wypłatę #${info.row.original.id}`}
          text="Zweryfikuj"
          showLabel
          onClick={() => setVerifiedId(info.row.original.id)}
        />
      ),
    }),
  ]

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold">Wypłaty odrzucone przez pracowników</h2>
      <DataTable data={payouts} columns={columns} storageKey="rejected-payouts" />
      {verified && (
        <VerifyRejectedPayoutDialog payout={verified} onClose={() => setVerifiedId(undefined)} />
      )}
    </section>
  )
}
