'use client'

import { createColumnHelper } from '@tanstack/react-table'
import type { PendingReportRowT } from '@/lib/db/worker-reports'
import { formatPLDateTime } from '@/lib/utils/format-date'

const col = createColumnHelper<PendingReportRowT>()

export const PENDING_WORK_REPORT_COLUMNS = [
  col.accessor('investmentName', { header: 'Inwestycja' }),
  col.accessor('workerName', { header: 'Pracownik' }),
  col.accessor('sentAt', {
    header: 'Wysłano',
    cell: (info) => formatPLDateTime(info.getValue()),
  }),
  col.accessor('lineCount', {
    header: 'Pozycji',
    meta: { align: 'right' },
    cell: (info) => <span className="tabular-nums">{info.getValue()}</span>,
  }),
]
