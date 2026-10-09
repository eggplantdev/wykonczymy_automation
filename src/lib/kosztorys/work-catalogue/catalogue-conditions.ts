import { isTranslationStale, translationText } from '@/lib/i18n/description-translations'
import { LANGUAGE_SHORT, TRANSLATION_LANGUAGES } from '@/lib/i18n/languages'
import { TOOL_PLANES } from '@/lib/kosztorys/constants'
import { planeDashSuffix } from '@/lib/kosztorys/format'
import { PLANE_LABELS, PRICE_SOURCE_LABELS } from '@/lib/kosztorys/labels'
import { clientShareCeilingLabel } from '@/lib/kosztorys/subcontractor-price-guard'
import {
  catalogueRateAmount,
  catalogueRateFor,
  catalogueSourceOf,
  isCatalogueOverCeiling,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type { CatalogueUsageT, WorkCatalogueItemT } from '@/lib/kosztorys/work-catalogue/types'
import type { PriceSourceT, ToolPlaneT } from '@/lib/kosztorys/types'

export type CatalogueConditionT = {
  // Persisted in localStorage — renaming one silently drops the filter a reader left engaged.
  id: string
  kind: 'filter' | 'problem'
  group: string
  label: string
  matches: (entry: WorkCatalogueItemT) => boolean
}

const hasPrice = (entry: WorkCatalogueItemT) => entry.clientPrice > 0

const sourceOn = (entry: WorkCatalogueItemT, plane: ToolPlaneT) =>
  catalogueSourceOf(catalogueRateFor(entry, plane))

// „auto" names no stawka, so it can be neither zero nor under the ceiling — it prices off whichever
// inwestycja it lands in, and counting it „w granicy" would promise a limit nobody has checked.
const namesRate = (entry: WorkCatalogueItemT, plane: ToolPlaneT) =>
  sourceOn(entry, plane) !== 'auto'

const planeName = (plane: ToolPlaneT) => PLANE_LABELS[plane].toLowerCase()

const SOURCE_ORDER: PriceSourceT[] = ['amount', 'coeff', 'auto']

const PROBLEMS: CatalogueConditionT[] = [
  {
    id: 'catalogue-no-price',
    kind: 'problem',
    group: 'Cena',
    label: 'bez ceny j.m.',
    matches: (entry) => !hasPrice(entry),
  },
  ...TOOL_PLANES.map(
    (plane): CatalogueConditionT => ({
      id: `catalogue-zero-rate-${plane}`,
      kind: 'problem',
      group: 'Stawki',
      label: `stawka 0 zł — ${planeName(plane)}`,
      matches: (entry) => namesRate(entry, plane) && catalogueRateAmount(entry, plane) === 0,
    }),
  ),
  ...TRANSLATION_LANGUAGES.flatMap((language): CatalogueConditionT[] => [
    {
      id: `catalogue-no-translation-${language}`,
      kind: 'problem',
      group: 'Tłumaczenia',
      label: `bez tłumaczenia (${LANGUAGE_SHORT[language]})`,
      matches: (entry) => translationText(entry.descriptionTranslations, language) === '',
    },
    {
      id: `catalogue-stale-translation-${language}`,
      kind: 'problem',
      group: 'Tłumaczenia',
      label: `z nieaktualnym tłumaczeniem (${LANGUAGE_SHORT[language]})`,
      matches: (entry) =>
        isTranslationStale(entry.descriptionTranslations, language, entry.description),
    },
  ]),
]

// The plane rides in every label, not only in the heading: cmdk keys its rows by label, and „auto"
// exists once per plane.
const FILTERS: CatalogueConditionT[] = [
  ...TOOL_PLANES.flatMap((plane) =>
    SOURCE_ORDER.map(
      (source): CatalogueConditionT => ({
        id: `catalogue-source-${source}-${plane}`,
        kind: 'filter',
        group: 'Źródło stawki',
        label: `${PRICE_SOURCE_LABELS[source]}${planeDashSuffix(plane)}`,
        matches: (entry) => sourceOn(entry, plane) === source,
      }),
    ),
  ),
  ...TOOL_PLANES.flatMap((plane): CatalogueConditionT[] => [
    {
      id: `catalogue-over-ceiling-${plane}`,
      kind: 'filter',
      group: 'Udział w cenie',
      label: `ponad ${clientShareCeilingLabel(plane)}${planeDashSuffix(plane)}`,
      matches: (entry) => isCatalogueOverCeiling(entry, plane),
    },
    {
      id: `catalogue-within-ceiling-${plane}`,
      kind: 'filter',
      group: 'Udział w cenie',
      label: `w granicy ${clientShareCeilingLabel(plane)}${planeDashSuffix(plane)}`,
      matches: (entry) =>
        namesRate(entry, plane) && hasPrice(entry) && !isCatalogueOverCeiling(entry, plane),
    },
  ]),
]

export const CATALOGUE_CONDITIONS: CatalogueConditionT[] = [...PROBLEMS, ...FILTERS]

const CATALOGUE_DUPLICATE_ID = 'catalogue-near-duplicate'

export const CATALOGUE_PROBLEM_IDS = [
  ...PROBLEMS.map((condition) => condition.id),
  CATALOGUE_DUPLICATE_ID,
]

export function catalogueDuplicateCondition(
  nearDuplicates: ReadonlyMap<number, unknown>,
): CatalogueConditionT {
  return {
    id: CATALOGUE_DUPLICATE_ID,
    kind: 'problem',
    group: 'Opis',
    label: 'z możliwym duplikatem',
    matches: (entry) => nearDuplicates.has(entry.id),
  }
}

const usagePair = (
  key: string,
  group: string,
  [none, some]: readonly [string, string],
  isUsed: (entry: WorkCatalogueItemT) => boolean,
): CatalogueConditionT[] => [
  { id: `${key}-unused`, kind: 'filter', group, label: none, matches: (entry) => !isUsed(entry) },
  { id: `${key}-used`, kind: 'filter', group, label: some, matches: isUsed },
]

export function catalogueUsageConditions(usage: CatalogueUsageT): CatalogueConditionT[] {
  return [
    ...usagePair(
      'catalogue-usage',
      'Kosztorysy',
      ['w żadnym kosztorysie', 'w kosztorysach'],
      (entry) => (usage.byId[entry.id] ?? 0) > 0,
    ),
    ...usagePair(
      'catalogue-template',
      'Szablony',
      ['w żadnym szablonie', 'w szablonach'],
      (entry) => (usage.templateNamesById[entry.id]?.length ?? 0) > 0,
    ),
  ]
}

export function countCatalogueConditions(
  rows: readonly WorkCatalogueItemT[],
  conditions: readonly CatalogueConditionT[],
): Map<string, number> {
  return new Map(
    conditions.map((condition) => [condition.id, rows.filter(condition.matches).length]),
  )
}

// An engaged filter hides what it matches; an engaged problem keeps only what it matches. Ids that
// name no condition fall through untouched — see `useEngagedIds`.
export function applyCatalogueConditions(
  rows: readonly WorkCatalogueItemT[],
  conditions: readonly CatalogueConditionT[],
  engagedIds: ReadonlySet<string>,
): WorkCatalogueItemT[] {
  const engaged = conditions.filter((condition) => engagedIds.has(condition.id))
  if (engaged.length === 0) return [...rows]
  return rows.filter((entry) =>
    engaged.every((condition) =>
      condition.kind === 'problem' ? condition.matches(entry) : !condition.matches(entry),
    ),
  )
}
