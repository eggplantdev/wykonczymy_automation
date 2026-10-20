'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { DataTable } from '@/components/tables/data-table/data-table'
import { CancelTransferButton } from '@/components/transfers/cancel-transfer-button'
import { CollapsibleSection } from '@/components/ui/collapsible-section'
import { OptionalLink } from '@/components/ui/optional-link'
import { TRANSFER_TYPE_LABELS } from '@/lib/constants/transfers'
import type { RejectedReceiptT } from '@/lib/db/receipt-confirmation'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDate, formatPLDateTime } from '@/lib/utils/format-date'
import { transferHref } from '@/lib/utils/investment-transfers-href'

const col = createColumnHelper<RejectedReceiptT>()

export function RejectedReceipts({ receipts }: { receipts: RejectedReceiptT[] }) {
  if (receipts.length === 0) return null

  const columns = [
    col.display({
      id: 'actions',
      header: 'Anuluj',
      cell: ({ row: { original: receipt } }) => (
        <CancelTransferButton
          transactionId={receipt.id}
          disabledReason={receipt.investmentLockMessage}
        />
      ),
    }),
    col.accessor('id', {
      header: 'ID',
      cell: ({ row: { original: receipt } }) => (
        <OptionalLink href={transferHref(receipt.id, receipt.investmentId)}>
          #{receipt.id}
        </OptionalLink>
      ),
    }),
    col.accessor('date', { header: 'Data', cell: (info) => formatPLDate(info.getValue()) }),
    col.accessor('type', {
      header: 'Typ',
      meta: { minWidth: 'min-w-40' },
      cell: (info) => TRANSFER_TYPE_LABELS[info.getValue()],
    }),
    col.accessor('recipientName', {
      header: 'Pracownik',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: receipt } }) => (
        <OptionalLink href={`/pracownicy/${receipt.recipientId}`}>
          {receipt.recipientName}
        </OptionalLink>
      ),
    }),
    col.accessor('amount', {
      header: 'Kwota',
      cell: (info) => formatPLN(info.getValue()),
    }),
    col.accessor('investmentName', {
      header: 'Inwestycja',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: receipt } }) => (
        <OptionalLink
          href={receipt.investmentId === null ? undefined : `/inwestycje/${receipt.investmentId}`}
        >
          {receipt.investmentName ?? '—'}
        </OptionalLink>
      ),
    }),
    col.accessor('registerName', {
      header: 'Kasa',
      meta: { minWidth: 'min-w-40' },
      cell: ({ row: { original: receipt } }) => (
        <OptionalLink
          href={
            receipt.registerId === null || receipt.registerTrashed
              ? undefined
              : `/kasa/${receipt.registerId}`
          }
        >
          {receipt.registerName ?? '—'}
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
        <DataTable data={receipts} columns={columns} storageKey="rejected-payouts" />
      </CollapsibleSection>
    </section>
  )
}
