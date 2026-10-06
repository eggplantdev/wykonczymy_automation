'use client'

import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { OptionalLink } from '@/components/ui/optional-link'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import { useTranslation } from '@/hooks/use-translation'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { cn } from '@/lib/utils/cn'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'
import { isServerSortableDraftColumn } from '@/lib/worker-expenses/sortable-columns'

const col = createColumnHelper<ExpenseDraftRowT>()

type OptionsT = {
  isManagerView: boolean
  // The dashboard queue: nothing in it is decided yet, and opening one is the whole point of the row.
  isPendingQueue?: boolean
  canEditPages?: boolean
  // Management reads the worker's own table too, and only management may open the transfers list.
  canOpenTransfers?: boolean
  actions?: (draft: ExpenseDraftRowT) => ReactNode
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
  canEditPages = false,
  canOpenTransfers = isManagerView,
  actions,
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

  return [
    ...(isPendingQueue ? actionsColumn : []),
    ...(isManagerView
      ? [col.accessor('workerName', { header: t('worker'), enableSorting: sortable('workerName') })]
      : []),
    col.accessor('investmentName', {
      header: t('investment'),
      enableSorting: sortable('investmentName'),
    }),
    col.accessor('sentAt', {
      header: t('sentAt'),
      enableSorting: sortable('sentAt'),
      cell: (info) => formatPLDateTime(info.getValue()),
    }),
    col.display({
      id: 'media',
      header: t('attachments'),
      meta: { align: 'center' },
      cell: ({ row: { original: draft } }) => (
        <ExpenseDraftPagesCell
          draftId={draft.id}
          media={draft.media}
          isEditable={canEditPages && draft.status === 'pending'}
        />
      ),
    }),
    col.accessor('note', {
      header: t('note'),
      enableSorting: false,
      cell: (info) => <span className="break-words">{info.getValue() ?? '—'}</span>,
    }),
    ...(isPendingQueue
      ? []
      : [
          col.accessor('status', {
            header: t('status'),
            enableSorting: sortable('status'),
            cell: (info) => <DraftStatusBadge status={info.getValue()} />,
          }),
          col.accessor('decidedAt', {
            header: t('decision'),
            enableSorting: sortable('decidedAt'),
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
            meta: { align: 'right' },
            cell: ({ row: { original: draft } }) => (
              <TransferCell draft={draft} isLinked={canOpenTransfers} />
            ),
          }),
          ...actionsColumn,
        ]),
  ]
}
