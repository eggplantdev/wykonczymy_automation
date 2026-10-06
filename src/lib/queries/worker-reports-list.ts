import 'server-only'
import { getPayload } from 'payload'
import config from '@payload-config'
import { requireAuth } from '@/lib/auth/require-auth'
import { MANAGEMENT_ROLES } from '@/lib/auth/roles'
import { getDb } from '@/lib/db/get-db'
import {
  countPendingForInvestment,
  listDecidableReports,
  listReportFilterOptions,
  type ReportListRowT,
  type WorkerReportFiltersT,
} from '@/lib/db/worker-reports'
import type { PaginationMetaT, PaginationParamsT } from '@/lib/utils/pagination'
import type { ReferenceItemT } from '@/types/reference-data'

// Uncached: the dialog opens on a report someone may have decided a second ago in another window.
export async function managementDb() {
  const session = await requireAuth(MANAGEMENT_ROLES)
  if (!session.success) throw new Error(session.error)
  return getDb(await getPayload({ config }))
}

export type WorkerReportsPageT = {
  rows: ReportListRowT[]
  paginationMeta: PaginationMetaT
  investments: ReferenceItemT[]
  workers: ReferenceItemT[]
}

export async function fetchWorkerReportsPage(
  filters: WorkerReportFiltersT,
  pagination: PaginationParamsT,
  sort: string | undefined,
): Promise<WorkerReportsPageT> {
  const db = await managementDb()
  const [{ rows, totalDocs }, options] = await Promise.all([
    listDecidableReports(db, filters, pagination, sort),
    listReportFilterOptions(db),
  ])
  return {
    rows,
    paginationMeta: {
      currentPage: pagination.page,
      totalPages: Math.max(1, Math.ceil(totalDocs / pagination.limit)),
      totalDocs,
      limit: pagination.limit,
    },
    ...options,
  }
}

export async function countInvestmentPendingReports(investmentId: number): Promise<number> {
  return countPendingForInvestment(await managementDb(), investmentId)
}
