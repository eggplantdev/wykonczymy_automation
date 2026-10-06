'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { createColumnHelper } from '@tanstack/react-table'
import { DraftStatusBadge } from '@/components/worker-expenses/draft-status-badge'
import { ExpenseDraftPagesCell } from '@/components/worker-expenses/expense-draft-pages-cell'
import { useTranslation } from '@/hooks/use-translation'
import { isServerSortableDraftColumn } from '@/lib/constants/worker-expense-drafts'
import type { ExpenseDraftRowT } from '@/lib/db/worker-expense-drafts'
import { formatPLN } from '@/lib/utils/format-currency'
import { formatPLDateTime } from '@/lib/utils/format-date'
import { investmentTransfersHref } from '@/lib/utils/investment-transfers-href'

const col = createColumnHelper<ExpenseDraftRowT>()

type OptionsT = {
  /** Management sees every worker's drafts, sorts them and opens the booked transaction. */
  isManagerView: boolean
  /** The worker adds and removes photos on his own pending drafts. */
  canEditPages?: boolean
  actions?: (draft: ExpenseDraftRowT) => ReactNode
}

function ExpenseCell({ draft, isLinked }: { draft: ExpenseDraftRowT; isLinked: boolean }) {
  if (draft.transferAmount === null) return '—'
  const amount = <span className="tabular-nums">{formatPLN(draft.transferAmount)}</span>
  if (!isLinked || draft.transferId === null || draft.transferInvestmentId === null) return amount
  return (
    <Link
      href={investmentTransfersHref(draft.transferInvestmentId, { id: draft.transferId })}
      className="hover:underline"
    >
      {amount}
    </Link>
  )
}

export function useExpenseDraftColumns({ isManagerView, canEditPages = false, actions }: OptionsT) {
  const { t } = useTranslation('expenseDrafts')
  const sortable = (id: string) => isManagerView && isServerSortableDraftColumn(id)

  return [
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
          ? [formatPLDateTime(draft.decidedAt), draft.decidedByName].filter(Boolean).join(' · ')
          : '—',
    }),
    col.accessor('transferAmount', {
      header: t('expense'),
      enableSorting: false,
      meta: { align: 'right' },
      cell: ({ row: { original: draft } }) => (
        <ExpenseCell draft={draft} isLinked={isManagerView} />
      ),
    }),
    ...(actions
      ? [
          col.display({
            id: 'actions',
            header: '',
            meta: { label: t('actions') },
            cell: ({ row: { original: draft } }) => (
              <div className="flex items-center gap-1">{actions(draft)}</div>
            ),
          }),
        ]
      : []),
  ]
}
