'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { WORKER_REPORT_COLUMNS } from '@/components/tables/worker-reports'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { REPORT_PARAM } from '@/lib/kosztorys/worker-report/report-param'

export function WorkerReportsDataTable({ data }: { data: ReportListRowT[] }) {
  return (
    <DataTable
      data={data}
      columns={WORKER_REPORT_COLUMNS}
      storageKey="worker-reports"
      getRowHref={(row) => `/inwestycje/${row.investmentId}/kosztorys_v2?${REPORT_PARAM}=${row.id}`}
    />
  )
}
