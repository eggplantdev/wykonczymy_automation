'use client'

import { useSearchParams } from 'next/navigation'
import { QueueFilters } from '@/components/filters/queue-filters'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { WORKER_REPORT_COLUMNS } from '@/components/tables/worker-reports'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { ScanReportButton } from '@/components/worker-reports/scan-report-button'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { reportHref } from '@/lib/kosztorys/worker-report/report-param'
import { REPORT_STATUSES, REPORT_STATUS_LABELS } from '@/lib/kosztorys/worker-report/report-status'
import { validWorkerReportSort } from '@/lib/queries/worker-report-sort'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'

const WORKER_REPORTS_BASE_URL = '/zgloszenia-prac'

const STATUS_OPTIONS = REPORT_STATUSES.map((status) => ({
  value: status,
  label: REPORT_STATUS_LABELS[status],
}))

type PropsT = {
  data: ReportListRowT[]
  paginationMeta: PaginationMetaT
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
}

export function WorkerReportsDataTable({ data, paginationMeta, investments, workers }: PropsT) {
  const searchParams = useSearchParams()
  const { updateParam } = useUrlFilterParams(WORKER_REPORTS_BASE_URL)

  return (
    <>
      <QueueFilters
        baseUrl={WORKER_REPORTS_BASE_URL}
        statusOptions={STATUS_OPTIONS}
        investments={investments}
        workers={workers}
      />
      <DataTable
        data={data}
        columns={WORKER_REPORT_COLUMNS}
        storageKey="worker-reports"
        toolbar={() => <DataTableToolbar actions={<ScanReportButton />} />}
        sorting={sortParamToSortingState(
          validWorkerReportSort(searchParams.get('sort') ?? undefined),
        )}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
        getRowHref={(row) => reportHref(row.investmentId, row.id)}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={WORKER_REPORTS_BASE_URL} />
    </>
  )
}
