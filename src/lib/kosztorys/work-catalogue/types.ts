import type { KosztorysItemT, KosztorysSectionT } from '@/lib/kosztorys/types'

// The catalogue row as every reader sees it. A stawka is one of two things, decided per plane:
// a frozen ZŁOTÓWKA that travels into every rozpiska verbatim, or `null` = „auto", meaning the
// katalog declines to name one and the praca prices off the TARGET investment's global
// współczynnik. What the katalog still never holds is a coefficient of its own — that would be a
// third concept re-pricing a frozen decision behind the owner's back, whereas `null` simply says
// no decision was made here.
export type WorkCatalogueItemT = {
  id: number
  description: string
  category: string | null
  unit: string
  clientPrice: number
  wToolsRate: number | null
  ownToolsRate: number | null
  matchKey: string
}

export type CatalogueSeedItemT = Omit<WorkCatalogueItemT, 'id'>

// One occurrence of a klucz inside the szablon, kept only so a rozbieżność can be shown with the
// sekcja it came from — the owner recognises „Łazienka 1 mówi 300 zł" and nothing else.
export type SeedOccurrenceT = {
  sectionName: string
  clientPrice: number
  wToolsRate: number | null
  ownToolsRate: number | null
}

// Which of the three liczby a rozbieżność is about — the cennik diverges on the stawki far more
// often than on the „Cena j.m.", and the two mean different things to the owner.
export type SeedConflictFieldT = 'clientPrice' | 'wToolsRate' | 'ownToolsRate'

// A klucz whose occurrences do not agree on all three liczby. Reported, never resolved by hand:
// the winner rule already picked, this only says the pick was not unanimous.
export type SeedConflictT = {
  matchKey: string
  description: string
  fields: SeedConflictFieldT[]
  occurrences: SeedOccurrenceT[]
}

// One praca from a rozpiska as „Zapisz do katalogu…" reads it. The inwestycja's global
// współczynniki are deliberately absent: a plane with no nadpisanie of its own goes to the cennik as
// „auto", so there is nothing left for a global to price.
export type CatalogueSourceItemT = {
  description: string
  unit: string
  sectionName: string
  clientPrice: number
  wToolsOverrideValue: number | null
  ownToolsOverrideValue: number | null
}

// What the „Zapisz do katalogu…" dialog renders: the row that WOULD be written, and the cennik row
// already holding its klucz — the presence of the second is the whole nowa/nadpisz question.
export type CatalogueSavePreviewT = {
  candidate: CatalogueSeedItemT
  existing: WorkCatalogueItemT | null
}

// A rozjazd is a difference of RODZAJ as much as of kwota: a frozen złotówka against a katalog that
// declines to name a stawka („auto") disagrees even when the two land on the same number, and the
// column has to say „auto" rather than print a kwota nobody typed. Flags, not `number | null`, so
// `delta` stays a number — an „auto" side compares as the kwota it implies for THIS inwestycja,
// which is the only sensible input to a difference. „Cena j.m." is never „auto".
export type CatalogueFigureDiffT = {
  label: string
  // What the zaznaczenie and the wire carry — the Polish etykieta is for the reader only, and keying
  // a selection off it would put a display string in a payload.
  field: SeedConflictFieldT
  kosztorys: number
  catalogue: number
  delta: number
  kosztorysIsAuto: boolean
  catalogueIsAuto: boolean
}

export type CataloguePriceDiffT = {
  itemId: number
  description: string
  unit: string
  // The rozpiska's own cena j.m., carried even when it agrees with the cennik: the 65 % ceiling is
  // measured against it, and a praca that differs only on a stawka has no „Cena j.m." figure to read
  // it from.
  clientPrice: number
  figures: CatalogueFigureDiffT[]
  // The largest of this praca's rozbieżności — what the list sorts by, so the biggest money is read
  // first rather than found.
  maxDelta: number
}

export type CatalogueMissingT = {
  itemId: number
  section: string
  description: string
  unit: string
  // The closest cennik opis, or nothing. DISPLAY ONLY — this never matches, never prices anything
  // and never decides which kubełek a praca lands in; it exists so „brak w katalogu" on a praca that
  // IS there under a slightly different name is recognisable as such.
  hint: string | null
}

// What the hurtowy zapis actually wrote, shaped as the patch the grid applies to its rows — only the
// liczby that were ticked are present, and a stawka taken from a katalogowe „auto" arrives as an
// explicit `null`, because dropping the nadpisanie IS the write.
export type AppliedCatalogueValueT = { itemId: number } & Partial<
  Pick<KosztorysItemT, 'clientPrice' | 'wToolsOverrideValue' | 'ownToolsOverrideValue'>
>

export type CatalogueComparisonT = {
  matching: number
  diffs: CataloguePriceDiffT[]
  missing: CatalogueMissingT[]
}

// The sekcja rides along for the report only — the cennik is global, so it takes no part in the
// matching.
export type CatalogueComparisonItemT = KosztorysItemT & { sectionName?: string }

export type CatalogueComparisonSettingsT = { wToolsCoeff: number; ownToolsCoeff: number }

// The created rows in the nested shape `getKosztorysTree` yields, so the grid can build its rows
// without a refetch — same contract as `AppendedSliceT`, one section instead of many.
export type AppendedCatalogueSliceT = {
  section: KosztorysSectionT & { items: KosztorysItemT[] }
  warnings: string[]
}
