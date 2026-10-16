import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

export function divergentPriceRowIds(rows: KosztorysV2RowT[]): Set<number> {
  const groups = new Map<string, { ids: number[]; prices: Set<number> }>()
  for (const row of rows) {
    if (!(row.clientPrice > 0)) continue
    const description = row.description?.trim()
    // One with no opis is not „the same praca" as another empty one — `foldDescription('')` would
    // weld them together.
    if (!description) continue
    const key = catalogueKey(description, row.unit)
    const group = groups.get(key) ?? { ids: [], prices: new Set<number>() }
    group.ids.push(row.id)
    group.prices.add(row.clientPrice)
    groups.set(key, group)
  }
  const diverging = new Set<number>()
  for (const { ids, prices } of groups.values()) {
    if (prices.size > 1) for (const id of ids) diverging.add(id)
  }
  return diverging
}
