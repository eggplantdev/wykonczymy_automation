import { requireManagementPage } from '@/lib/auth/require-management-page'
import { fetchWorkerReportsPage } from '@/lib/queries/worker-reports-list'
import { parseQueueFilters } from '@/lib/queries/queue-filters'
import { isReportStatus } from '@/lib/kosztorys/worker-report/report-status'
import { parseWorkerReportSort } from '@/lib/queries/worker-report-sort'
import { parsePagination } from '@/lib/utils/pagination'
import { WorkerReportsDataTable } from '@/components/worker-reports/worker-reports-data-table'
import { Description } from '@/components/ui/description'
import { PageWrapper } from '@/components/ui/page-wrapper'
import { PAGE_TITLES } from '@/lib/constants/sections'
import type { PagePropsT } from '@/types/page'

export default async function WorkerReportsPage({ searchParams }: PagePropsT) {
  await requireManagementPage()
  const sp = await searchParams
  const reports = await fetchWorkerReportsPage(
    parseQueueFilters(sp, isReportStatus),
    parsePagination(sp),
    parseWorkerReportSort(sp),
  )

  return (
    <PageWrapper title={PAGE_TITLES.workerReports}>
      <Description>
        Bez sortowania na górze zgłoszenia czekające na decyzję, niżej rozpatrzone — w nich też
        można jeszcze przyjąć odrzucone pozycje. „Podgląd” pokazuje zgłoszenie na miejscu, a „Otwórz
        w kosztorysie” otwiera rozpiskę inwestycji z tym zgłoszeniem.
      </Description>
      <WorkerReportsDataTable
        data={reports.rows}
        paginationMeta={reports.paginationMeta}
        investments={reports.investments}
        workers={reports.workers}
      />
    </PageWrapper>
  )
}
