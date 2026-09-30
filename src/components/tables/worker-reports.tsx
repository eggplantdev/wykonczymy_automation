'use client'

import { createColumnHelper } from '@tanstack/react-table'
import { WorkerReportStatusBadge } from '@/components/worker-reports/worker-report-status-badge'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { formatPLDateTime } from '@/lib/utils/format-date'

const col = createColumnHelper<ReportListRowT>()

export const WORKER_REPORT_COLUMNS = [
  col.accessor('investmentName', { header: 'Inwestycja' }),
  col.accessor('workerName', { header: 'Pracownik' }),
  col.accessor('sentAt', {
    header: 'Wysłano',
    cell: (info) => formatPLDateTime(info.getValue()),
  }),
  col.accessor('lineCount', {
    header: 'Prace',
    meta: { align: 'right' },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    cell: (info) => <WorkerReportStatusBadge {...info.row.original} />,
  }),
]
