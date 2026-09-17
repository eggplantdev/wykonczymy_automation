'use client'

import { useMemo } from 'react'
import { createJsonMapStore, useJsonMap, type JsonMapStoreT } from '@/hooks/create-json-map-store'
import type { InvestmentStatusT } from '@/types/reference-data'

const DEFAULT_STATUSES: InvestmentStatusT[] = ['active', 'planowana']
// `szablon` is missing because fetchReferenceData already drops it. In display order, and read by
// StatusFilter too so the two can't drift.
export const FILTERABLE_STATUSES: InvestmentStatusT[] = ['planowana', 'active', 'completed']

const STORAGE_PREFIX = 'table-status-filter:'

// One store per key, cached: `createJsonMapStore` mints its own listener set, so a store rebuilt per
// render would hand useSyncExternalStore a new `subscribe` on every pass.
const stores = new Map<string, JsonMapStoreT<boolean>>()

function storeFor(storageKey: string): JsonMapStoreT<boolean> {
  const cached = stores.get(storageKey)
  if (cached) return cached
  const store = createJsonMapStore<boolean>(STORAGE_PREFIX + storageKey)
  stores.set(storageKey, store)
  return store
}

// A flag per status, never a list of the picked ones: an empty list cannot tell „nikt jeszcze nie
// wybierał" from „wybrano nic". An absent map falls back to the defaults, an explicit all-false is
// honoured as the empty selection it is.
export function selectionFrom(persisted: Record<string, boolean>): Set<InvestmentStatusT> {
  const answered = FILTERABLE_STATUSES.filter((status) => typeof persisted[status] === 'boolean')
  if (answered.length === 0) return new Set(DEFAULT_STATUSES)
  return new Set(answered.filter((status) => persisted[status]))
}

export function filterByStatuses<TItem>(
  data: TItem[],
  selectedStatuses: Set<InvestmentStatusT>,
  getStatus: (item: TItem) => InvestmentStatusT,
): TItem[] {
  return data.filter((item) => selectedStatuses.has(getStatus(item)))
}

// `storageKey` remembers the pick across visits. Through the same localStorage store as the kosztorys
// column preferences, so the stored string IS the render input — no post-hydration effect writing
// state, and the server's empty snapshot renders the defaults the client also starts from.
export function useStatusFilter<TItem>(
  data: TItem[],
  getStatus: (item: TItem) => InvestmentStatusT,
  storageKey: string,
) {
  const store = storeFor(storageKey)
  const persisted = useJsonMap<boolean>(store)
  const selectedStatuses = useMemo(() => selectionFrom(persisted), [persisted])

  const toggleStatus = (status: InvestmentStatusT) => {
    store.update((prev) => {
      const current = selectionFrom(prev)
      return Object.fromEntries(
        FILTERABLE_STATUSES.map((valid) => [
          valid,
          valid === status ? !current.has(valid) : current.has(valid),
        ]),
      )
    })
  }

  const filteredData = useMemo(
    () => filterByStatuses(data, selectedStatuses, getStatus),
    [data, selectedStatuses, getStatus],
  )

  return { filteredData, selectedStatuses, toggleStatus } as const
}
