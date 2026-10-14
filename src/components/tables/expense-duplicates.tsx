'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { documentHref } from '@/lib/expense-duplicates/document-href'
import { isWeakMatch, type MatchReasonT } from '@/lib/expense-duplicates/match'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { DuplicateMatchT } from '@/lib/queries/expense-draft-duplicates'
import { cn } from '@/lib/utils/cn'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { formatPLDate } from '@/lib/utils/format-date'
import { firstNoteLine } from '@/lib/utils/invoice-note'

export type ExpenseDuplicateRowT = DuplicateMatchT & {
  paragon: string
  // The acceptance form's line item the paragon was prefilled into.
  paragonItemId: string
  paragonReadRow: number
}

type ColumnsOptionsT<R> = {
  showParagon: boolean
  actions?: (row: R) => ReactNode
  // The finder links each document out; the acceptance dialog keeps its rows on one screen.
  linkMatch?: boolean
}

const REASON_LABELS: Record<MatchReasonT, string> = {
  'same-number': 'Ten sam numer',
  'same-receipt': 'Ta sama kwota, data i sklep',
  'same-amount': 'Ta sama kwota',
}

export const reasonsLabel = (reasons: MatchReasonT[]) =>
  reasons.map((reason) => REASON_LABELS[reason]).join(', ')

export function getExpenseDuplicateColumns<R extends DuplicateMatchT & { paragon?: string }>({
  showParagon,
  actions,
  linkMatch = false,
}: ColumnsOptionsT<R>) {
  const col = createColumnHelper<R>()
  return [
    ...(showParagon
      ? [col.accessor((row) => row.paragon, { id: 'paragon', header: 'Paragon' })]
      : []),
    col.accessor((row) => row.reasons, {
      id: 'reasons',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={cn(
            'font-medium',
            isWeakMatch(row.original.reasons) ? 'text-muted-foreground' : 'text-destructive',
          )}
        >
          {reasonsLabel(row.original.reasons)}
        </span>
      ),
    }),
    col.display({
      id: 'match',
      header: 'Pasuje do',
      cell: ({ row }) => {
        const label = `${row.original.source === 'transaction' ? 'Transakcja' : 'Zgłoszenie'} #${row.original.id}`
        return linkMatch ? (
          <Link
            href={documentHref(row.original)}
            target="_blank"
            className="whitespace-nowrap underline underline-offset-4"
          >
            {label}
          </Link>
        ) : (
          <span className="whitespace-nowrap">{label}</span>
        )
      },
    }),
    col.accessor((row) => row.documentNumber ?? firstNoteLine(row.invoiceNote) ?? '—', {
      id: 'document',
      header: 'Dokument',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
    }),
    // The printed date is what the manager can check against the photo; the booking date is the fallback.
    col.accessor((row) => row.documentDate ?? row.date, {
      id: 'date',
      header: 'Data',
      cell: (info) => formatPLDate(info.getValue()),
    }),
    col.accessor((row) => row.amount, {
      id: 'amount',
      header: 'Kwota',
      meta: { align: 'right' },
      cell: (info) => formatPLNOrDash(info.getValue()),
    }),
    col.accessor((row) => row.investmentName, {
      id: 'investmentName',
      header: 'Inwestycja',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() ?? '—'}</span>,
    }),
    col.accessor((row) => row.submitterName, {
      id: 'submitterName',
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
