'use client'

import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { MediaPreviewButton } from '@/components/dialogs/media-preview-button'
import { OptionalLink } from '@/components/ui/optional-link'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { DraftProgressBadge } from '@/components/worker-expenses/draft-progress-badge'
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
      ? [
          col.accessor('workerName', {
            header: t('worker'),
            enableSorting: sortable('workerName'),
            cell: ({ row: { original: draft } }) => (
              <OptionalLink href={`/pracownicy/${draft.workerId}`}>{draft.workerName}</OptionalLink>
            ),
          }),
        ]
      : []),
    col.accessor('investmentName', {
      header: t('investment'),
      enableSorting: sortable('investmentName'),
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
      cell: (info) => <span className="break-words">{info.getValue() ?? '—'}</span>,
    }),
    ...(isPendingQueue
      ? [
          col.display({
            id: 'progress',
            header: 'Paragony',
            cell: ({ row: { original: draft } }) =>
              draft.progress ? <DraftProgressBadge progress={draft.progress} /> : '—',
          }),
        ]
      : [
          col.accessor('status', {
            header: t('status'),
            enableSorting: sortable('status'),
            cell: ({ row: { original: draft } }) => (
              <span className="flex flex-wrap items-center gap-2">
                <DraftStatusBadge status={draft.status} />
                {draft.status === 'pending' && draft.progress && (
                  <DraftProgressBadge progress={draft.progress} />
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
