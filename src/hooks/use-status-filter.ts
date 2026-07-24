import { useMemo, useState } from 'react'
import type { InvestmentStatusT } from '@/types/reference-data'

const DEFAULT_STATUSES: InvestmentStatusT[] = ['active', 'planowana']

export function filterByStatuses<TItem>(
  data: TItem[],
  selectedStatuses: Set<InvestmentStatusT>,
  getStatus: (item: TItem) => InvestmentStatusT,
): TItem[] {
  return data.filter((item) => selectedStatuses.has(getStatus(item)))
}

export function useStatusFilter<TItem>(
  data: TItem[],
  getStatus: (item: TItem) => InvestmentStatusT,
) {
  const [selectedStatuses, setSelectedStatuses] = useState(new Set(DEFAULT_STATUSES))

  const toggleStatus = (status: InvestmentStatusT) => {
    setSelectedStatuses((prev) => {
      const next = new Set(prev)
      if (next.has(status)) {
        next.delete(status)
      } else {
        next.add(status)
      }
      return next
    })
  }

  const filteredData = useMemo(
    () => filterByStatuses(data, selectedStatuses, getStatus),
    [data, selectedStatuses, getStatus],
  )

  return { filteredData, selectedStatuses, toggleStatus } as const
}
