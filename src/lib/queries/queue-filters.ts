import type { ResolvedSearchParamsT } from '@/types/page'
import type { QueueFiltersT } from '@/types/filters'
import { dayBound } from '@/lib/utils/date-range'
import { listParam } from '@/lib/utils/list-param'
import { parseNumericIds } from '@/lib/utils/parse-numeric-ids'

export function parseQueueFilters<StatusT extends string>(
  searchParams: ResolvedSearchParamsT,
  isStatus: (value: string) => value is StatusT,
): QueueFiltersT<StatusT> {
  return {
    statuses: listParam(searchParams.status, (param) => param.split(',').filter(isStatus)),
    investmentIds: listParam(searchParams.investment, parseNumericIds),
    workerIds: listParam(searchParams.worker, parseNumericIds),
    sentRange: { from: dayBound(searchParams.from), to: dayBound(searchParams.to) },
  }
}
