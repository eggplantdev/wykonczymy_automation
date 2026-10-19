'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { OptionalLink } from '@/components/ui/optional-link'
import type { RejectedPayoutT } from '@/lib/db/payout-confirmation'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { transferHref } from '@/lib/utils/investment-transfers-href'

const col = createColumnHelper<RejectedPayoutT>()

export function RejectedPayouts({ payouts }: { payouts: RejectedPayoutT[] }) {
  if (payouts.length === 0) return null

  const columns = [
    col.display({
      id: 'actions',
      header: 'Anuluj',
      cell: ({ row: { original: payout } }) => (
        <CancelTransferButton
          transactionId={payout.id}
          disabledReason={payout.investmentLockMessage}
        />
      ),
    }),
    col.accessor('id', {
      header: 'ID',
      cell: ({ row: { original: payout } }) => (
        <OptionalLink href={transferHref(payout.id, payout.investmentId)}>
          #{payout.id}
        </OptionalLink>
      ),
    }),
    col.accessor('date', { header: 'Data', cell: (info) => formatPLDate(info.getValue()) }),
    col.accessor('workerName', {
      header: 'Pracownik',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: payout } }) => (
        <OptionalLink href={`/pracownicy/${payout.workerId}`}>{payout.workerName}</OptionalLink>
      ),
    }),
    col.accessor('amount', {
      header: 'Kwota',
      cell: (info) => formatPLN(info.getValue()),
    }),
    col.accessor('investmentName', {
      header: 'Inwestycja',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: payout } }) => (
        <OptionalLink
          href={payout.investmentId === null ? undefined : `/inwestycje/${payout.investmentId}`}
        >
          {payout.investmentName ?? '—'}
        </OptionalLink>
      ),
    }),
    col.accessor('sourceRegisterName', {
      header: 'Kasa',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: payout } }) => (
        <OptionalLink
          href={
            payout.sourceRegisterId === null || payout.sourceRegisterTrashed
              ? undefined
              : `/kasa/${payout.sourceRegisterId}`
          }
        >
          {payout.sourceRegisterName ?? '—'}
        </OptionalLink>
      ),
    }),
    col.accessor('description', {
      header: 'Opis',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => <span className="whitespace-pre-line">{info.getValue() || '—'}</span>,
    }),
    col.accessor('rejectionReason', {
      header: 'Powód',
      meta: { minWidth: 'min-w-56' },
      cell: (info) => <span className="whitespace-pre-line">{info.getValue()}</span>,
    }),
    col.accessor('decidedAt', {
      header: 'Odrzucona',
      meta: { minWidth: 'min-w-36' },
      cell: (info) => formatPLDateTime(info.getValue()),
    }),
  ]

  return (
    <section>
      <CollapsibleSection
        title="Wypłaty odrzucone przez pracowników"
        hint="Takie wypłaty trzeba wyjaśnić z pracownikiem lub anulować."
        size="sm"
        withSeparator={false}
        storageKey="rejected-payouts:open"
      >
        <DataTable data={payouts} columns={columns} storageKey="rejected-payouts" />
      </CollapsibleSection>
    </section>
  )
}
