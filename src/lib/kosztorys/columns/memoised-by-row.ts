import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Rows are replaced immutably on every edit, so row identity is a self-invalidating cache key — a
// stale value can't outlive the row it was computed from.
export function memoisedByRow<T>(compute: (row: KosztorysV2RowT) => T) {
  const cache = new WeakMap<KosztorysV2RowT, { value: T }>()
  return (row: KosztorysV2RowT) => {
    const hit = cache.get(row)
    if (hit) return hit.value
    const value = compute(row)
    cache.set(row, { value })
    return value
  }
}
