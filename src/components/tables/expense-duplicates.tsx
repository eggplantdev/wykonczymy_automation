'use client'

// Same shape as `telmak-check.tsx`, so EX-1026's audit can reuse the columns.
import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import type { MatchReasonT } from '@/lib/expense-duplicates/match'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { DuplicateMatchT } from '@/lib/queries/expense-draft-duplicates'
import { cn } from '@/lib/utils/cn'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { firstNoteLine } from '@/lib/utils/invoice-note'

export type ExpenseDuplicateRowT = DuplicateMatchT & {
  paragon: string
  paragonRowIndex: number
  paragonMediaIds: number[]
}

type ColumnsOptionsT = {
  showParagon: boolean
  actions?: (row: ExpenseDuplicateRowT) => ReactNode
}

const REASON_LABELS: Record<MatchReasonT, string> = {
  'same-number': 'Ten sam numer',
  'same-receipt': 'Ta sama kwota, data i sklep',
  'same-amount': 'Podobna kwota i data',
}

const col = createColumnHelper<ExpenseDuplicateRowT>()

export function getExpenseDuplicateColumns({ showParagon, actions }: ColumnsOptionsT) {
  return [
    ...(showParagon ? [col.accessor('paragon', { header: 'Paragon' })] : []),
    col.accessor('reasons', {
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={cn(
            'font-medium',
            row.original.tier === 'strong' ? 'text-destructive' : 'text-muted-foreground',
          )}
        >
          {row.original.reasons.map((reason) => REASON_LABELS[reason]).join(', ')}
        </span>
      ),
    }),
    col.display({
      id: 'match',
      header: 'Pasuje do',
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.source === 'transaction' ? 'Transakcja' : 'Zgłoszenie'} #{row.original.id}
        </span>
      ),
    }),
    col.accessor((row) => row.documentNumber ?? firstNoteLine(row.invoiceNote) ?? '—', {
      id: 'document',
      header: 'Dokument',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
    }),
    col.accessor('date', {
      header: 'Data',
      cell: (info) => formatPLDate(info.getValue()),
    }),
    col.accessor('amount', {
      header: 'Kwota',
      meta: { align: 'right' },
      cell: (info) => formatPLNOrDash(info.getValue()),
    }),
    col.accessor('investmentName', {
      header: 'Inwestycja',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor('submitterName', {
      header: 'Kto',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? '—'}</span>,
    }),
    col.display({
      id: 'preview',
      header: 'Podgląd',
      meta: { align: 'center' },
      cell: ({ row }) =>
        row.original.pages.length > 0 && (
          <MediaPreviewButton
            labels={INVOICE_PREVIEW_LABELS}
            files={row.original.pages}
            label="Zdjęcie"
            variant="compact"
          />
        ),
    }),
    ...(actions
      ? [
          col.display({
            id: 'actions',
            header: 'Akcje',
            meta: { align: 'right' },
            cell: ({ row }) => actions(row.original),
          }),
        ]
      : []),
  ]
}
