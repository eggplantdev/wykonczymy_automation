import type { ResolvedSearchParamsT } from '@/types/page'
import type { WorkerReportFiltersT } from '@/lib/db/worker-reports'
import { isReportStatus } from '@/lib/kosztorys/worker-report/report-status'
import { dayBound } from '@/lib/utils/date-range'
import { parseNumericIds } from '@/lib/utils/parse-numeric-ids'

function listParam<T>(value: unknown, parse: (param: string) => T[]): T[] | null {
  return typeof value === 'string' && value !== '' ? parse(value) : null
}

export function parseWorkerReportFilters(
  searchParams: ResolvedSearchParamsT,
): WorkerReportFiltersT {
  return {
    statuses: listParam(searchParams.status, (param) => param.split(',').filter(isReportStatus)),
    investmentIds: listParam(searchParams.investment, parseNumericIds),
    workerIds: listParam(searchParams.worker, parseNumericIds),
    sentRange: { from: dayBound(searchParams.from), to: dayBound(searchParams.to) },
  }
}
