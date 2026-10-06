'use client'

import { useState } from 'react'
import { CircleDot, Landmark } from 'lucide-react'
import { FilterMultiSelect } from '@/components/filters/filter-multi-select'
import { DataTable } from '@/components/tables/data-table/data-table'
import { useWorkerReportColumns } from '@/components/tables/worker-reports'
import { ControlGrid } from '@/components/ui/control-grid'
import { PageNav } from '@/components/ui/pagination/page-nav'
import { PaginationBar } from '@/components/ui/pagination/pagination-bar'
import { useReportPreview } from '@/components/worker-reports/use-report-preview'
import { WorkerReportRowActions } from '@/components/worker-reports/worker-report-row-actions'
import { useClientMultiFilter } from '@/hooks/use-client-multi-filter'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL_KEYS,
} from '@/lib/kosztorys/worker-report/report-status'

// The page also pages and filters transfers through the URL, so this table keeps its page, limit and
// filters in state — two URL-driven tables on one page would fight over `page` / `limit` / `investment`.
const DEFAULT_PAGE_SIZE = 10

const getStatus = (report: ReportListRowT) => report.status
const getInvestment = (report: ReportListRowT) => String(report.investmentId)

type PropsT = {
  reports: ReportListRowT[]
  canOpenInKosztorys: boolean
}

export function WorkerReportHistoryTable({ reports, canOpenInKosztorys }: PropsT) {
  const { t } = useTranslation('workerReports')
  const { t: tDrafts } = useTranslation('expenseDrafts')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE)

  const {
    filteredData: byStatus,
    values: statusFilter,
    setValues: setStatusFilter,
  } = useClientMultiFilter(reports, getStatus)
  const {
    filteredData: filtered,
    values: investmentFilter,
    setValues: setInvestmentFilter,
  } = useClientMultiFilter(byStatus, getInvestment)

  const preview = useReportPreview()
  const columns = useWorkerReportColumns({
    isManagerView: false,
    actions: (report) => (
      <WorkerReportRowActions
        report={report}
        canOpenInKosztorys={canOpenInKosztorys}
        onPreview={preview.open}
        isLoading={preview.loadingId === report.id}
        isDisabled={preview.loadingId !== undefined}
      />
    ),
  })

  const investmentOptions = [
    ...new Map(reports.map((report) => [report.investmentId, report.investmentName])),
  ]
    .map(([id, name]) => ({ value: String(id), label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'pl'))

  const totalPages = Math.ceil(filtered.length / pageSize)
  // A refresh can shrink the list under the page he is on.
  const currentPage = Math.min(page, Math.max(1, totalPages))

  function narrow(apply: () => void) {
    apply()
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-3">
      <ControlGrid>
        <FilterMultiSelect
          values={statusFilter}
          onValuesChange={(values) => narrow(() => setStatusFilter(values))}
          options={REPORT_STATUSES.map((status) => ({
            value: status,
            label: t(REPORT_STATUS_LABEL_KEYS[status]),
          }))}
          label={tDrafts('status')}
          icon={CircleDot}
        />
        <FilterMultiSelect
          values={investmentFilter}
          onValuesChange={(values) => narrow(() => setInvestmentFilter(values))}
          options={investmentOptions}
          label={tDrafts('investment')}
          icon={Landmark}
          searchable
        />
      </ControlGrid>
      <DataTable
        data={filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
        columns={columns}
        storageKey="worker-report-history"
      />
      <PaginationBar
        totalDocs={filtered.length}
        limit={pageSize}
        onLimitChange={(limit) => narrow(() => setPageSize(limit))}
        className="mt-0"
      >
        <PageNav
          currentPage={currentPage}
          totalPages={totalPages}
          renderPage={(target, isInert, children) => (
            <button type="button" disabled={isInert} onClick={() => setPage(target)}>
              {children}
            </button>
          )}
        />
      </PaginationBar>
      {preview.dialog}
    </div>
  )
}
