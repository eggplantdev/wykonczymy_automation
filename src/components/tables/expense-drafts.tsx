'use client'

import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { MediaPreviewButton } from '@/components/media/media-preview-button'
import { OptionalLink } from '@/components/ui/optional-link'
import { SelectPageHeader, SelectRowCell } from '@/components/tables/data-table/select-column'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { DecisionProgressBadge } from '@/components/ui/decision-progress-badge'
import { useTranslation } from '@/hooks/use-translation'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { INVOICE_PREVIEW_LABELS } from '@/lib/media/wording'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { isServerSortableDraftColumn } from '@/lib/worker-expenses/sortable-columns'

const col = createColumnHelper<ExpenseDraftRowT>()

const duplicateOfLabel = ({ source, id }: DuplicateOfT) =>
  source === 'transaction' ? `Duplikat #${id}` : `Duplikat zgłoszenia #${id}`

type OptionsT = {
  isManagerView: boolean
  // The dashboard queue: nothing in it is decided yet, and opening one is the whole point of the row.
  isPendingQueue?: boolean
  // Management reads the worker's own table too, and only management may open the transfers list
  // or the investment.
  canOpenTransfers?: boolean
  actions?: (draft: ExpenseDraftRowT) => ReactNode
  // The queue ticks zgłoszenia to merge them; read from `SelectedIdsContext`.
  selection?: { onToggle: (id: number) => void; onTogglePage: (ids: number[]) => void }
}

// A history row stands for one paragon, so it carries at most one transakcja.
function TransferCell({ draft, isLinked }: { draft: ExpenseDraftRowT; isLinked: boolean }) {
  const [transfer] = draft.transfers
  if (!transfer) return '—'
  const href =
    isLinked && transfer.investmentId !== null
      ? investmentTransfersHref(transfer.investmentId, {
          id: transfer.id,
          showCancelled: transfer.cancelled,
        })
      : undefined
  return (
    <OptionalLink href={href}>
      <span
        className={cn('tabular-nums', transfer.cancelled && 'text-muted-foreground line-through')}
      >
        {formatPLN(transfer.amount)}
      </span>
    </OptionalLink>
  )
}

export function useExpenseDraftColumns({
  isManagerView,
  isPendingQueue = false,
  canOpenTransfers = isManagerView,
  actions,
  selection,
}: OptionsT) {
  const { t } = useTranslation('expenseDrafts')
  const sortable = (id: string) =>
    isManagerView && !isPendingQueue && isServerSortableDraftColumn(id)
  const actionsColumn = actions
    ? [
        col.display({
          id: 'actions',
          header: isPendingQueue ? t('preview') : '',
          meta: { label: t('actions') },
          cell: ({ row: { original: draft } }) => (
            <div className="flex items-center gap-1">{actions(draft)}</div>
          ),
        }),
      ]
    : []

  const selectColumn = selection
    ? [
        col.display({
          id: 'select',
          size: 40,
          enableHiding: false,
          header: ({ table }) => (
            <SelectPageHeader
              pageIds={table.getRowModel().rows.map((row) => row.original.id)}
              onTogglePage={selection.onTogglePage}
            />
          ),
          cell: ({ row: { original: draft } }) => (
            <SelectRowCell
              id={draft.id}
              label={t('selectDraft', { name: draft.workerName })}
              onToggle={selection.onToggle}
            />
          ),
        }),
      ]
    : []

  return [
    ...selectColumn,
    ...(isPendingQueue ? actionsColumn : []),
    ...(isManagerView
      ? [
          col.accessor('workerName', {
            header: t('worker'),
            enableSorting: sortable('workerName'),
            meta: { minWidth: 'min-w-40' },
            cell: ({ row: { original: draft } }) => (
              <OptionalLink href={`/pracownicy/${draft.workerId}`}>{draft.workerName}</OptionalLink>
            ),
          }),
        ]
      : []),
    col.accessor('investmentName', {
      header: t('investment'),
      enableSorting: sortable('investmentName'),
      meta: { minWidth: 'min-w-56' },
      cell: ({ row: { original: draft } }) => (
        <OptionalLink
          href={
            canOpenTransfers && draft.investmentId !== null
              ? `/inwestycje/${draft.investmentId}`
              : undefined
          }
        >
          {draft.investmentName ?? t('noInvestment')}
        </OptionalLink>
      ),
    }),
    col.accessor('sentAt', {
      header: t('sentAt'),
      enableSorting: sortable('sentAt'),
      meta: { minWidth: 'min-w-40' },
      cell: (info) => formatPLDateTime(info.getValue()),
    }),
    col.display({
      id: 'media',
      header: t('attachments'),
      meta: { align: 'center' },
      cell: ({ row: { original: draft } }) => (
        <MediaPreviewButton labels={INVOICE_PREVIEW_LABELS} files={draft.media} variant="compact" />
      ),
    }),
    col.accessor('note', {
      header: t('note'),
      enableSorting: false,
      meta: { minWidth: 'min-w-64' },
      cell: (info) => <span className="break-words">{info.getValue() ?? '—'}</span>,
    }),
    ...(isPendingQueue
      ? [
          col.display({
            id: 'progress',
            header: t('receipts'),
            meta: { minWidth: 'min-w-48' },
            cell: ({ row: { original: draft } }) =>
              draft.progress ? <DecisionProgressBadge {...draft.progress} /> : '—',
          }),
        ]
      : [
          col.accessor('status', {
            header: t('status'),
            enableSorting: sortable('status'),
            meta: { minWidth: 'min-w-48' },
            cell: ({ row: { original: draft } }) => (
              <span className="flex flex-wrap items-center gap-2">
                {draft.progress ? (
                  <DecisionProgressBadge {...draft.progress} />
                ) : (
                  <DraftStatusBadge status={draft.status} />
                )}
                {/* The worker sees only „Odrzucone". */}
                {isManagerView && draft.duplicateOf && (
                  <span className="text-destructive text-xs whitespace-nowrap">
                    {duplicateOfLabel(draft.duplicateOf)}
                  </span>
                )}
              </span>
            ),
          }),
          col.accessor('decidedAt', {
            header: t('decision'),
            enableSorting: sortable('decidedAt'),
            meta: { minWidth: 'min-w-56' },
            cell: ({ row: { original: draft } }) =>
              draft.decidedAt
                ? [formatPLDateTime(draft.decidedAt), draft.decidedByName]
                    .filter(Boolean)
                    .join(' · ')
                : '—',
          }),
          col.accessor('transfers', {
            header: t('transfers'),
            enableSorting: false,
            meta: { align: 'right', minWidth: 'min-w-28' },
            cell: ({ row: { original: draft } }) => (
              <TransferCell draft={draft} isLinked={canOpenTransfers} />
            ),
          }),
          ...actionsColumn,
        ]),
  ]
}
