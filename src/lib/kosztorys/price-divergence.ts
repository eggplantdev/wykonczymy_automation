import type { KosztorysV2RowT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

/**
 * Ids of the pozycje where the SAME praca is priced differently somewhere else in the kosztorys.
 *
 * A question about a GROUP, which no `matches(row, ctx)` can answer — so it is computed once, one
 * pass above the registry, and handed in as a fact the way `hasSettledMaterial` is.
 *
 * Grouped by `catalogueKey`, the katalog's own identity for a praca — chosen because it drops the
 * sekcja, and the owner's rozjazd runs Łazienka ↔ Kuchnia, so grouping per sekcja would never see it.
 *
 * Two pozycje are left out of every group. One with no cena j.m. has two diagnostics of its own, and
 * the registry keeps its counts disjoint. One with no opis is not „the same praca" as another empty
 * one — `foldDescription('')` would weld them together.
 *
 * The whole group is returned, not the odd one out: nothing here knows which price is the right one,
 * and picking the majority would be the katalog's silent rule that this diagnostic exists to expose.
 */
export function divergentPriceRowIds(rows: KosztorysV2RowT[]): Set<number> {
  const groups = new Map<string, { ids: number[]; prices: Set<number> }>()
  for (const row of rows) {
    if (!(row.clientPrice > 0)) continue
    const description = row.description?.trim()
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
