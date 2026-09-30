'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { PENDING_WORK_REPORT_COLUMNS } from '@/components/tables/work-reports'
import type { PendingReportRowT } from '@/lib/db/worker-reports'

export function PendingWorkReportsDataTable({ data }: { data: PendingReportRowT[] }) {
  return (
    <DataTable
      data={data}
      columns={PENDING_WORK_REPORT_COLUMNS}
      storageKey="pending-work-reports"
      getRowHref={(row) => `/inwestycje/${row.investmentId}/kosztorys_v2?zgloszenie=${row.id}`}
    />
  )
}
