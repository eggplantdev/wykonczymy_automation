import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type { WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'

// The members a pozycja names its katalog praca by — the picker has no use for the rest of a row.
export type KosztorysItemRefT = {
  description: string | null
  unit: string | null
  catalogueItemId: number | null
}

export type KosztorysCatalogueRefT = { catalogueItemId: number | null; matchKey: string }

/**
 * Fold the rozpiska down to the katalog's own identity for each pozycja.
 *
 * Split from the partition below so it can be cached on the rozpiska ALONE: `catalogueKey` is
 * `foldDescription`, ~45 split/join passes per row, and the partition's other input changes on every
 * character typed into the szukajka. Folding a 1000-pozycja kosztorys per keystroke is the exact
 * trap `useSearchFilter` was already split to avoid.
 *
 * A nameless pozycja is skipped rather than folded to an empty key: the katalog cannot hold one, so
 * it could only ever match by accident.
 */
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

/**
 * The prace the kosztorys already holds, resolved the way „Porównaj z katalogiem" resolves them —
 * by the remembered entry first, so a praca renamed in the katalog still counts as added.
 */
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

/**
 * Split the cennik into prace the kosztorys does not hold yet and the ones it does.
 *
 * The whole kosztorys is the scope, not one sekcja: a praca already placed in another pokój is the
 * case the owner wants out of the way.
 */
export function partitionAlreadyInKosztorys(
  catalogue: readonly WorkCatalogueItemT[],
  takenIds: ReadonlySet<number>,
): { fresh: WorkCatalogueItemT[]; alreadyAdded: WorkCatalogueItemT[] } {
  const fresh: WorkCatalogueItemT[] = []
  const alreadyAdded: WorkCatalogueItemT[] = []
  for (const item of catalogue) (takenIds.has(item.id) ? alreadyAdded : fresh).push(item)
  return { fresh, alreadyAdded }
}
