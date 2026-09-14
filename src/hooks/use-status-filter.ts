'use client'

import { useMemo } from 'react'
import { createJsonMapStore, useJsonMap, type JsonMapStoreT } from '@/hooks/create-json-map-store'
import type { InvestmentStatusT } from '@/types/reference-data'

// Deliberately three-element, not four: `szablon` is the hidden templates workbench, and its
// absence here IS how it stays off /inwestycje — filterByStatuses keeps only statuses in the
// selected set, and no checkbox can ever put `szablon` there. Don't "fix" this by adding it.
const DEFAULT_STATUSES: InvestmentStatusT[] = ['active', 'planowana']
const VALID_STATUSES: InvestmentStatusT[] = ['active', 'completed', 'planowana']

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

// A flag per status, never a list of the picked ones: the persisted map has to tell „nikt jeszcze nie
// wybierał" from „wybrano nic", and an empty list says both. So an absent (or client-corrupted) map
// falls back to the defaults, while an explicit all-false is honoured as the empty selection it is.
export function selectionFrom(persisted: Record<string, boolean>): Set<InvestmentStatusT> {
  const answered = VALID_STATUSES.filter((status) => typeof persisted[status] === 'boolean')
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

// `storageKey` remembers the pick across visits — the filter resetting to the defaults on every
// navigation was the complaint. Through the same localStorage store as the kosztorys column
// preferences, so the stored string IS the render input: no post-hydration effect writing state, and
// the server's empty snapshot renders the defaults the client also starts from.
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
        VALID_STATUSES.map((valid) => [
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
