import { useMemo, useState } from 'react'
import type { InvestmentStatusT } from '@/types/reference-data'

// `open` = the working set (active + planowana), the default view that hides finished jobs.
export type StatusViewT = 'open' | 'planowana' | 'active' | 'completed' | 'all'

const MATCHES: Record<StatusViewT, (status: InvestmentStatusT) => boolean> = {
  open: (s) => s === 'active' || s === 'planowana',
  planowana: (s) => s === 'planowana',
  active: (s) => s === 'active',
  completed: (s) => s === 'completed',
  all: () => true,
}

export function filterByStatusView<TItem>(
  data: TItem[],
  statusView: StatusViewT,
  getStatus: (item: TItem) => InvestmentStatusT,
): TItem[] {
  return data.filter((item) => MATCHES[statusView](getStatus(item)))
}

export function useStatusFilter<TItem>(
  data: TItem[],
  getStatus: (item: TItem) => InvestmentStatusT,
) {
  const [statusView, setStatusView] = useState<StatusViewT>('open')

  const filteredData = useMemo(
    () => filterByStatusView(data, statusView, getStatus),
    [data, statusView, getStatus],
  )

  return { filteredData, statusView, setStatusView } as const
}
