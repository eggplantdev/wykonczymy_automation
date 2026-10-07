import 'server-only'
import {
  countPendingForInvestment,
  listDecidableReports,
  listReportFilterOptions,
  type ReportListRowT,
  type WorkerReportFiltersT,
} from '@/lib/db/worker-reports'
import { managementDb } from '@/lib/queries/management-db'
import { paginationMetaFromCount, type PaginationParamsT } from '@/lib/utils/pagination'
import type { QueuePageT } from '@/types/filters'

export async function fetchWorkerReportsPage(
  filters: WorkerReportFiltersT,
  pagination: PaginationParamsT,
  sort: string | undefined,
): Promise<QueuePageT<ReportListRowT>> {
  const db = await managementDb()
  const [{ rows, totalDocs }, options] = await Promise.all([
    listDecidableReports(db, filters, pagination, sort),
    listReportFilterOptions(db),
  ])
  return {
    rows,
    paginationMeta: paginationMetaFromCount(totalDocs, pagination),
    ...options,
  }
}

export async function countInvestmentPendingReports(investmentId: number): Promise<number> {
  return countPendingForInvestment(await managementDb(), investmentId)
}
