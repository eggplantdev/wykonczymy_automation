import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'

type EntryT = { id: number; matchKey: string }

export type CatalogueIndexT<T extends EntryT> = {
  byId: ReadonlyMap<number, T>
  byKey: ReadonlyMap<string, T>
}

export const indexCatalogue = <T extends EntryT>(entries: readonly T[]): CatalogueIndexT<T> => ({
  byId: new Map(entries.map((entry) => [entry.id, entry])),
  byKey: new Map(entries.map((entry) => [entry.matchKey, entry])),
})

export function resolveCatalogueEntry<T extends EntryT>(
  index: CatalogueIndexT<T>,
  catalogueItemId: number | null | undefined,
  matchKey: () => string,
): T | undefined {
  const linked = catalogueItemId == null ? undefined : index.byId.get(catalogueItemId)
  return linked ?? index.byKey.get(matchKey())
}

type ItemRefT = { description: string | null; unit: string | null; catalogueItemId: number | null }

export function itemsHoldingEntry<R extends ItemRefT, T extends EntryT>(
  index: CatalogueIndexT<T>,
  rows: readonly R[],
  entryId: number,
): R[] {
  return rows.filter(
    (row) =>
      row.description?.trim() &&
      resolveCatalogueEntry(index, row.catalogueItemId, () =>
        catalogueKey(row.description ?? '', row.unit),
      )?.id === entryId,
  )
}
