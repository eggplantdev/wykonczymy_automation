// A pozycja names its katalog praca twice: by the entry it remembers (EX-1017) and by its opis + j.m.
// The remembered entry wins — it survives a rename of the praca in the katalog — and the klucz is
// the answer only for a pozycja that remembers none, or one whose entry was deleted. Every reader
// that pairs pozycje with prace goes through here, so „Porównaj z katalogiem", „Komentarz do pracy",
// „już w kosztorysie" and the usage counter cannot disagree about which praca a pozycja is.

type EntryT = { id: number; matchKey: string }

export type CatalogueIndexT<T extends EntryT> = {
  byId: ReadonlyMap<number, T>
  byKey: ReadonlyMap<string, T>
}

export const indexCatalogue = <T extends EntryT>(entries: readonly T[]): CatalogueIndexT<T> => ({
  byId: new Map(entries.map((entry) => [entry.id, entry])),
  byKey: new Map(entries.map((entry) => [entry.matchKey, entry])),
})

// `matchKey` is a thunk: folding an opis is the expensive half, and a pozycja found by its id never
// needs it.
export function resolveCatalogueEntry<T extends EntryT>(
  index: CatalogueIndexT<T>,
  catalogueItemId: number | null | undefined,
  matchKey: () => string,
): T | undefined {
  const linked = catalogueItemId == null ? undefined : index.byId.get(catalogueItemId)
  return linked ?? index.byKey.get(matchKey())
}
