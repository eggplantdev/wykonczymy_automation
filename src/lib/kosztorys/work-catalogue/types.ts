import type { KosztorysItemT, KosztorysSectionT, PriceSourceT } from '@/lib/kosztorys/types'
import type { CatalogueRateT } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'

// The catalogue row as every reader sees it. A stawka is one of THREE things per plane, and the pair
// of columns behind it says which: a frozen ZŁOTÓWKA that travels into every rozpiska verbatim, a
// MNOŻNIK of the target praca's cena j.m., or both `null` = „auto", meaning the katalog declines to
// name a stawka and the praca prices off the TARGET investment's global współczynnik.
//
// The mnożnik is the katalog's own decision, not a leaked investment współczynnik (EX-865): it says
// „ta praca kosztuje wykonawcę tyle ceny", which is exactly the sentence a cennik is for, and unlike
// a frozen kwota it survives being placed into a rozpiska priced differently.
export type WorkCatalogueItemT = {
  id: number
  description: string
  descriptionTranslations: DescriptionTranslationsT
  category: string | null
  unit: string
  clientPrice: number
  wToolsRate: number | null
  ownToolsRate: number | null
  wToolsRateCoeff: number | null
  ownToolsRateCoeff: number | null
  matchKey: string
  workNote: string | null
}

// Translations stay out of the seed: every katalog writer builds one, and a seed that required the
// map would overwrite a stored translation with `{}`. The writers that own translations pass them
// explicitly (`applyCatalogueWrite`). The Komentarz do pracy stays out for the same reason: a
// candidate rebuilt from a rozpiska row has none, and carrying `null` would erase the stored one.
export type CatalogueSeedItemT = Omit<
  WorkCatalogueItemT,
  'id' | 'descriptionTranslations' | 'workNote'
>

export type CatalogueCandidateT = CatalogueSeedItemT &
  Pick<WorkCatalogueItemT, 'descriptionTranslations'>

// What a praca takes over when it accepts a katalog name. The translations come along with the opis:
// the praca's own were made from the name it is giving up.
export type CatalogueNameT = Pick<WorkCatalogueItemT, 'description' | 'unit' | 'descriptionTranslations'>

// One occurrence of a klucz inside the szablon, kept only so a rozbieżność can be shown with the
// sekcja it came from — the owner recognises „Łazienka 1 mówi 300 zł" and nothing else.
export type SeedOccurrenceT = {
  sectionName: string
  clientPrice: number
  wToolsRate: CatalogueRateT
  ownToolsRate: CatalogueRateT
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
// „auto", so there is nothing left for a global to price. Both nadpisania travel, because both are
// decisions this wiersz made and the cennik keeps each as the źródło it was.
export type CatalogueSourceItemT = {
  description: string
  descriptionTranslations: DescriptionTranslationsT
  unit: string
  sectionName: string
  clientPrice: number
  wToolsOverrideValue: number | null
  ownToolsOverrideValue: number | null
  wToolsOverrideCoeff: number | null
  ownToolsOverrideCoeff: number | null
}

// What the „Zapisz do katalogu…" dialog renders: the row that WOULD be written, and the cennik row
// already holding its klucz — the presence of the second is the whole nowa/nadpisz question.
export type CatalogueSavePreviewT = {
  candidate: CatalogueCandidateT
  existing: WorkCatalogueItemT | null
}

// A rozjazd is a difference of RODZAJ as much as of kwota: a frozen złotówka against a katalog that
// prices off a mnożnik disagrees even when the two land on the same number today, because one of
// them will move when the cena j.m. does. The źródło, not a flag, so all three readings stay
// distinguishable (EX-865) — a boolean „isAuto" pair could only ever say two things. The kwota beside
// it is what each side implies for THIS inwestycja, which is the only sensible input to a difference.
// „Cena j.m." is never anything but `amount`.
export type CatalogueFigureDiffT = {
  label: string
  // What the zaznaczenie and the wire carry — the Polish etykieta is for the reader only, and keying
  // a selection off it would put a display string in a payload.
  field: SeedConflictFieldT
  kosztorys: number
  catalogue: number
  delta: number
  kosztorysSource: PriceSourceT
  catalogueSource: PriceSourceT
  // The mnożnik each side names, where it names one — the column prints the multiple rather than the
  // złotówka it happens to produce, because that multiple is what was agreed.
  kosztorysCoeff: number | null
  catalogueCoeff: number | null
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

// A „może chodzi o…" candidate. It carries the cennik row whole rather than its opis, because the
// three closest names are routinely the SAME name — 168 prace in the local dataset differ from their
// candidate only by j.m. — so the j.m. and the cena are what actually tell two candidates apart.
export type CatalogueHintT = Pick<
  WorkCatalogueItemT,
  'id' | 'description' | 'descriptionTranslations' | 'unit' | 'clientPrice'
> & { score: number }

export type CatalogueMissingT = {
  itemId: number
  section: string
  description: string
  unit: string
  // The closest cennik opisy, best first, or an empty list. A candidate is clickable — accepting one
  // rewrites the praca's NAME — but it still never matches, never prices anything and never decides
  // which kubełek a praca lands in: accepting is a write the owner makes, not a match this found.
  hints: CatalogueHintT[]
}

// What the hurtowy zapis actually wrote, shaped as the patch the grid applies to its rows — only the
// liczby that were ticked are present, and a stawka taken from a katalogowe „auto" arrives as an
// explicit `null` on BOTH kolumny tej płaszczyzny, because dropping the nadpisanie IS the write and
// leaving the other column standing would hand the row back the źródło that was just replaced.
export type AppliedCatalogueValueT = { itemId: number } & Partial<
  Pick<
    KosztorysItemT,
    | 'clientPrice'
    | 'wToolsOverrideValue'
    | 'ownToolsOverrideValue'
    | 'wToolsOverrideCoeff'
    | 'ownToolsOverrideCoeff'
  >
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

export type NewSectionCatalogueSliceT = AppendedCatalogueSliceT & { createdSection: boolean }

// A used klucz the cennik has no row for. Its opis / j.m. are the spelling most pozycje use, since
// the klucz itself is folded past anything the owner would recognise.
export type UncataloguedUsageT = {
  key: string
  description: string
  unit: string
  kosztorysCount: number
  hints: CatalogueHintT[]
}

// Plain records and arrays only: it crosses the server-action boundary.
export type CatalogueUsageT = {
  // Cennik id → distinct inwestycje using it. An id absent here is unused.
  byId: Record<number, number>
  otherUnitIds: number[]
  uncatalogued: UncataloguedUsageT[]
}

// `same` differs only in what folding cannot see (a word ending, the j.m. written into the opis, word
// order); `oneWord` has one word more or less, which is as often a deliberate variant as a duplicate.
export type NearDuplicateKindT = 'same' | 'oneWord'

export type NearDuplicateT = {
  entry: WorkCatalogueItemT
  kind: NearDuplicateKindT
}
