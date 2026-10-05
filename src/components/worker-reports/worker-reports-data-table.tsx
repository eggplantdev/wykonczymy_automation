'use client'

import { useSearchParams } from 'next/navigation'
import { DataTable } from '@/components/tables/data-table/data-table'
import { WORKER_REPORT_COLUMNS } from '@/components/tables/worker-reports'
import { PaginationFooter } from '@/components/ui/pagination-footer'
import { WorkerReportFilters } from '@/components/worker-reports/worker-report-filters'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { REPORT_PARAM } from '@/lib/kosztorys/worker-report/report-param'
import { validWorkerReportSort } from '@/lib/queries/worker-report-sort'
import { sortParamToSortingState, sortingStateToParam } from '@/lib/table/sort-param'
import type { PaginationMetaT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'

const WORKER_REPORTS_BASE_URL = '/zgloszenia-prac'

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
      <WorkerReportFilters
        baseUrl={WORKER_REPORTS_BASE_URL}
        investments={investments}
        workers={workers}
      />
      <DataTable
        data={data}
        columns={WORKER_REPORT_COLUMNS}
        storageKey="worker-reports"
        sorting={sortParamToSortingState(
          validWorkerReportSort(searchParams.get('sort') ?? undefined),
        )}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
        getRowHref={(row) =>
          `/inwestycje/${row.investmentId}/kosztorys_v2?${REPORT_PARAM}=${row.id}`
        }
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={WORKER_REPORTS_BASE_URL} />
    </>
  )
}
