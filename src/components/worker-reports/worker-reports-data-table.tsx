'use client'

import { useSearchParams } from 'next/navigation'
import { QueueFilters } from '@/components/filters/queue-filters'
import { DataTable } from '@/components/tables/data-table/data-table'
import { DataTableToolbar } from '@/components/tables/data-table/data-table-toolbar'
import { useWorkerReportColumns } from '@/components/tables/worker-reports'
import { PaginationFooter } from '@/components/ui/pagination/pagination-footer'
import { ScanReportButton } from '@/components/worker-reports/scan-report-button'
import { useReportPreview } from '@/components/worker-reports/use-report-preview'
import { WorkerReportRowActions } from '@/components/worker-reports/worker-report-row-actions'
import { useUrlFilterParams } from '@/hooks/use-url-filter-params'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import { useTranslation } from '@/hooks/use-translation'
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL_KEYS,
} from '@/lib/kosztorys/worker-report/report-status'
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
  const { t } = useTranslation('workerReports')
  const statusOptions = REPORT_STATUSES.map((status) => ({
    value: status,
    label: t(REPORT_STATUS_LABEL_KEYS[status]),
  }))
  const preview = useReportPreview()
  const columns = useWorkerReportColumns({
    isManagerView: true,
    actions: (report) => (
      <WorkerReportRowActions
        report={report}
        canOpenInKosztorys
        onPreview={preview.open}
        isLoading={preview.loadingId === report.id}
        isDisabled={preview.loadingId !== undefined}
      />
    ),
  })

  return (
    <>
      <QueueFilters
        baseUrl={WORKER_REPORTS_BASE_URL}
        statusOptions={statusOptions}
        investments={investments}
        workers={workers}
      />
      <DataTable
        data={data}
        columns={columns}
        storageKey="worker-reports"
        toolbar={() => <DataTableToolbar actions={<ScanReportButton />} />}
        sorting={sortParamToSortingState(
          validWorkerReportSort(searchParams.get('sort') ?? undefined),
        )}
        onSortingChange={(next) => updateParam('sort', sortingStateToParam(next))}
      />
      <PaginationFooter paginationMeta={paginationMeta} baseUrl={WORKER_REPORTS_BASE_URL} />
      {preview.dialog}
    </>
  )
}
