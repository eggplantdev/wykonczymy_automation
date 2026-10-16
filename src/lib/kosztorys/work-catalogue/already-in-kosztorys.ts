import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

export type KosztorysItemRefT = {
  description: string | null
  unit: string | null
  catalogueItemId: number | null
}

export type KosztorysCatalogueRefT = { catalogueItemId: number | null; matchKey: string }

// Split from the partition below so it can be cached on the rozpiska ALONE: the partition's other
// input changes on every character typed into the szukajka.
export function kosztorysCatalogueRefs(
  items: readonly KosztorysItemRefT[],
): KosztorysCatalogueRefT[] {
  return items
    .filter((item) => item.description?.trim())
    .map((item) => ({
      catalogueItemId: item.catalogueItemId ?? null,
      matchKey: catalogueKey(item.description ?? '', item.unit),
    }))
}

export function takenCatalogueIds(
  catalogue: readonly WorkCatalogueItemT[],
  refs: readonly KosztorysCatalogueRefT[],
): Set<number> {
  const index = indexCatalogue(catalogue)
  const taken = new Set<number>()
  for (const ref of refs) {
    const entry = resolveCatalogueEntry(index, ref.catalogueItemId, () => ref.matchKey)
    if (entry) taken.add(entry.id)
  }
  return taken
}

export function partitionAlreadyInKosztorys(
  catalogue: readonly WorkCatalogueItemT[],
  takenIds: ReadonlySet<number>,
): { fresh: WorkCatalogueItemT[]; alreadyAdded: WorkCatalogueItemT[] } {
  const fresh: WorkCatalogueItemT[] = []
  const alreadyAdded: WorkCatalogueItemT[] = []
  for (const item of catalogue) (takenIds.has(item.id) ? alreadyAdded : fresh).push(item)
  return { fresh, alreadyAdded }
}
