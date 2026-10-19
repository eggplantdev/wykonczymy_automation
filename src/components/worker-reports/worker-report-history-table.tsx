'use client'

import { DataTable } from '@/components/tables/data-table/data-table'
import { useWorkerReportColumns } from '@/components/tables/worker-reports'
import { ClientPagination } from '@/components/ui/pagination/client-pagination'
import { useReportPreview } from '@/components/worker-reports/use-report-preview'
import { WorkerReportRowActions } from '@/components/worker-reports/worker-report-row-actions'
import { useStatusInvestmentFilters } from '@/hooks/use-status-investment-filters'
import { useTranslation } from '@/hooks/use-translation'
import type { ReportListRowT } from '@/lib/db/worker-reports'
import {
  REPORT_STATUSES,
  REPORT_STATUS_LABEL_KEYS,
} from '@/lib/kosztorys/worker-report/report-status'

const getStatus = (report: ReportListRowT) => report.status
const getInvestment = (report: ReportListRowT) => String(report.investmentId)
const getInvestmentLabel = (report: ReportListRowT) => report.investmentName

type PropsT = {
  reports: ReportListRowT[]
  canOpenInKosztorys: boolean
}

export function WorkerReportHistoryTable({ reports, canOpenInKosztorys }: PropsT) {
  const { t } = useTranslation('workerReports')

  const { pageRows, bar, controls } = useStatusInvestmentFilters({
    rows: reports,
    getStatus,
    getInvestment,
    getInvestmentLabel,
    statusOptions: REPORT_STATUSES.map((status) => ({
      value: status,
      label: t(REPORT_STATUS_LABEL_KEYS[status]),
    })),
  })

  const preview = useReportPreview()
  const columns = useWorkerReportColumns({
    isManagerView: false,
    canOpenInvestment: canOpenInKosztorys,
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

  return (
    <div className="flex flex-col gap-3">
      {controls}
      <DataTable data={pageRows} columns={columns} storageKey="worker-report-history" />
      <ClientPagination {...bar} />
      {preview.dialog}
    </div>
  )
}
