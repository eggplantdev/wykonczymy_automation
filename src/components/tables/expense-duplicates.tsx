'use client'

import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { ExternalLink } from '@/components/ui/external-link'
import { MediaPreviewButton } from '@/components/media/media-preview-button'
import { documentHref } from '@/lib/expense-duplicates/document-href'
import { dayOf, isWeakMatch, type MatchReasonT } from '@/lib/expense-duplicates/match'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import type { DuplicateMatchT } from '@/lib/expense-duplicates/types'
import { cn } from '@/lib/utils/cn'
import { formatPLNOrDash } from '@/lib/utils/format-currency'
import { dateCell } from '@/components/tables/columns/date-cell'
import { firstNoteLine } from '@/lib/utils/invoice-note'
import { EMPTY_VALUE } from '@/lib/utils/empty-value'

export type ExpenseDuplicateRowT = DuplicateMatchT & {
  paragonItemId: string
  paragonReadRow: number
}

type ColumnsOptionsT<R> = {
  actions?: (row: R) => ReactNode
  linkMatch?: boolean
  labelMatch?: (row: R) => string | undefined
}

const REASON_LABELS: Record<MatchReasonT, string> = {
  'same-number': 'Ten sam numer',
  'same-receipt': 'Ta sama kwota, data i sklep',
  'same-amount': 'Ta sama kwota',
}

export const reasonsLabel = (reasons: MatchReasonT[]) =>
  reasons.map((reason) => REASON_LABELS[reason]).join(', ')

export function getExpenseDuplicateColumns<R extends DuplicateMatchT>({
  actions,
  linkMatch = false,
  labelMatch,
}: ColumnsOptionsT<R>) {
  const col = createColumnHelper<R>()
  return [
    ...(actions
      ? [
          col.display({
            id: 'actions',
            header: 'Akcje',
            cell: ({ row }) => actions(row.original),
          }),
        ]
      : []),
    col.accessor((row) => row.reasons, {
      id: 'reasons',
      header: 'Status',
      cell: ({ row }) => (
        <span
          className={cn(
            'font-medium whitespace-nowrap',
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
        const label =
          labelMatch?.(row.original) ??
          `${row.original.source === 'transaction' ? 'Transakcja' : 'Zgłoszenie'} #${row.original.id}`
        return linkMatch ? (
          <ExternalLink href={documentHref(row.original)} className="whitespace-nowrap">
            {label}
          </ExternalLink>
        ) : (
          <span className="whitespace-nowrap">{label}</span>
        )
      },
    }),
    // The day the match was judged on, so „Ta sama … data" never sits next to another date.
    col.accessor((row) => dayOf(row) ?? row.date, {
      id: 'date',
      header: 'Data',
      cell: (info) => dateCell(info),
    }),
    col.accessor((row) => row.amount, {
      id: 'amount',
      header: 'Kwota',
      meta: { align: 'right' },
      cell: (info) => formatPLNOrDash(info.getValue()),
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
    col.accessor((row) => row.investmentName, {
      id: 'investmentName',
      header: 'Inwestycja',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() || EMPTY_VALUE}</span>,
    }),
    col.accessor((row) => row.submitterName, {
      id: 'submitterName',
      header: 'Kto',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() || EMPTY_VALUE}</span>,
    }),
    col.accessor((row) => row.registerName, {
      id: 'registerName',
      header: 'Kasa',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue() || EMPTY_VALUE}</span>,
    }),
    col.accessor((row) => row.documentNumber ?? firstNoteLine(row.invoiceNote) ?? EMPTY_VALUE, {
      id: 'document',
      header: 'Dokument',
      cell: (info) => <span className="whitespace-nowrap">{info.getValue()}</span>,
    }),
  ]
}
