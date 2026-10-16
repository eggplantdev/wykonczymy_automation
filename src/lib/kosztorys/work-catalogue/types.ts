import type { KosztorysItemT, KosztorysSectionT, PriceSourceT } from '@/lib/kosztorys/types'
import type { CatalogueRateT } from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type { DescriptionTranslationsT } from '@/lib/i18n/description-translations'

// A stawka is one of THREE things per plane: a frozen ZŁOTÓWKA that travels into every rozpiska verbatim,
// a MNOŻNIK of the target praca's cena j.m., or both `null` = „auto", meaning the katalog declines to
// name a stawka and the praca prices off the TARGET investment's global współczynnik.
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
// map would overwrite a stored translation with `{}`.
export type CatalogueSeedItemT = Omit<
  WorkCatalogueItemT,
  'id' | 'descriptionTranslations' | 'workNote'
>

export type CatalogueCandidateT = CatalogueSeedItemT &
  Pick<WorkCatalogueItemT, 'descriptionTranslations'>

export type CatalogueNameT = Pick<
  WorkCatalogueItemT,
  'description' | 'unit' | 'descriptionTranslations'
>

export type SeedOccurrenceT = {
  sectionName: string
  clientPrice: number
  wToolsRate: CatalogueRateT
  ownToolsRate: CatalogueRateT
}

export type SeedConflictFieldT = 'clientPrice' | 'wToolsRate' | 'ownToolsRate'

export type SeedConflictT = {
  matchKey: string
  description: string
  fields: SeedConflictFieldT[]
  occurrences: SeedOccurrenceT[]
}

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

export type CatalogueSavePreviewT = {
  candidate: CatalogueCandidateT
  existing: WorkCatalogueItemT | null
  leaving: WorkCatalogueItemT | null
  templateNames: string[]
}

export type CatalogueFigureDiffT = {
  label: string
  field: SeedConflictFieldT
  kosztorys: number
  catalogue: number
  delta: number
  kosztorysSource: PriceSourceT
  catalogueSource: PriceSourceT
  kosztorysCoeff: number | null
  catalogueCoeff: number | null
}

export type CataloguePriceDiffT = {
  itemId: number
  description: string
  unit: string
  clientPrice: number
  figures: CatalogueFigureDiffT[]
  maxDelta: number
}

export type CatalogueHintT = Pick<
  WorkCatalogueItemT,
  'id' | 'description' | 'descriptionTranslations' | 'unit' | 'clientPrice'
> & { score: number }

export type CatalogueMissingT = {
  itemId: number
  section: string
  description: string
  unit: string
  hints: CatalogueHintT[]
}

// A stawka taken from a katalogowe „auto" arrives as an explicit `null` on BOTH kolumny tej płaszczyzny,
// because leaving the other column standing would hand the row back the źródło that was just replaced.
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
  entryByItemId: Map<number, RowCatalogueEntryT>
}

export type CatalogueComparisonItemT = KosztorysItemT & { sectionName?: string }

export type CatalogueComparisonSettingsT = {
  wToolsCoeff: number
  ownToolsCoeff: number
  linkedRowsAreCatalogue?: boolean
}

export type AppendedCatalogueSliceT = {
  section: KosztorysSectionT & { items: KosztorysItemT[] }
  warnings: string[]
}

export type NewSectionCatalogueSliceT = AppendedCatalogueSliceT & { createdSection: boolean }

export type UncataloguedUsageT = {
  key: string
  description: string
  unit: string
  kosztorysCount: number
  hints: CatalogueHintT[]
}

// Plain records and arrays only: it crosses the server → client props boundary.
export type CatalogueUsageT = {
  byId: Record<number, number>
  templateNamesById: Record<number, string[]>
  otherUnitIds: number[]
  uncatalogued: UncataloguedUsageT[]
}

export type NearDuplicateKindT = 'same' | 'oneWord'

export type NearDuplicateT = {
  entry: WorkCatalogueItemT
  kind: NearDuplicateKindT
}

export type RowCatalogueEntryT = { id: number; note: string | null }

export type CatalogueIdentityT = Pick<WorkCatalogueItemT, 'id' | 'descriptionTranslations'>
