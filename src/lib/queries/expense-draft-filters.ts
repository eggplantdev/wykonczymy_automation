import type { ResolvedSearchParamsT } from '@/types/page'
import { isExpenseDraftStatus } from '@/lib/constants/worker-expense-drafts'
import type { ExpenseDraftFiltersT } from '@/lib/db/worker-expense-drafts'
import { dayBound } from '@/lib/utils/date-range'
import { listParam } from '@/lib/utils/list-param'
import { parseNumericIds } from '@/lib/utils/parse-numeric-ids'

export function parseExpenseDraftFilters(
  searchParams: ResolvedSearchParamsT,
): ExpenseDraftFiltersT {
  return {
    statuses: listParam(searchParams.status, (param) =>
      param.split(',').filter(isExpenseDraftStatus),
    ),
    investmentIds: listParam(searchParams.investment, parseNumericIds),
    workerIds: listParam(searchParams.worker, parseNumericIds),
    sentRange: { from: dayBound(searchParams.from), to: dayBound(searchParams.to) },
  }
}
