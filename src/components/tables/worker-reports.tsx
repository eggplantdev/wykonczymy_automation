'use client'

import type { ReactNode } from 'react'
import { createColumnHelper } from '@tanstack/react-table'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { isServerSortableReportColumn } from '@/lib/kosztorys/worker-report/sortable-columns'
import { formatPLDateTime } from '@/lib/utils/format-date'

const col = createColumnHelper<ReportListRowT>()

type OptionsT = {
  isManagerView: boolean
  actions?: (report: ReportListRowT) => ReactNode
}

export function useWorkerReportColumns({ isManagerView, actions }: OptionsT) {
  const { t, locale } = useTranslation('workerReports')
  const { t: tDrafts } = useTranslation('expenseDrafts')
  const sortable = (id: string) => isManagerView && isServerSortableReportColumn(id)

  return [
    col.accessor('investmentName', {
      header: tDrafts('investment'),
      enableSorting: sortable('investmentName'),
    }),
    ...(isManagerView
      ? [
          col.accessor('workerName', {
            header: tDrafts('worker'),
            enableSorting: sortable('workerName'),
          }),
        ]
      : []),
    col.accessor('sentAt', {
      header: tDrafts('sentAt'),
      enableSorting: sortable('sentAt'),
      cell: (info) => formatPLDateTime(info.getValue(), locale),
    }),
    col.accessor('source', {
      header: t('source'),
      enableSorting: false,
      cell: (info) => (info.getValue() === 'scan' ? t('sourceScan') : t('sourceLink')),
    }),
    col.accessor('lineCount', {
      header: t('works'),
      enableSorting: sortable('lineCount'),
      meta: { align: 'right' },
      cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
    }),
    col.accessor('status', {
      header: tDrafts('status'),
      enableSorting: sortable('status'),
      cell: (info) => <WorkerReportStatusBadge {...info.row.original} />,
    }),
    col.accessor('decidedAt', {
      header: t('decision'),
      enableSorting: false,
      cell: ({ row: { original: report } }) =>
        report.decidedAt
          ? [formatPLDateTime(report.decidedAt, locale), report.decidedByName]
              .filter(Boolean)
              .join(' · ')
          : '—',
    }),
    ...(actions
      ? [
          col.display({
            id: 'actions',
            header: '',
            meta: { label: tDrafts('actions') },
            cell: ({ row: { original: report } }) => (
              <div className="flex items-center gap-1">{actions(report)}</div>
            ),
          }),
        ]
      : []),
  ]
}
