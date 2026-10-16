import {
  asViewPricing,
  overrideCoeffFor,
  priceSourceOf,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import { RATE_LABELS } from '@/lib/kosztorys/labels'
import type { KosztorysItemT, PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  catalogueRateFor,
  catalogueRateValue,
  catalogueSourceOf,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type {
  CatalogueComparisonItemT,
  CatalogueComparisonSettingsT,
  CatalogueComparisonT,
  CatalogueFigureDiffT,
  CatalogueHintT,
  CatalogueMissingT,
  CataloguePriceDiffT,
  RowCatalogueEntryT,
  SeedConflictFieldT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { bigrams, diceSimilarity } from '@/lib/utils/string-similarity'

const HINT_THRESHOLD = 0.55

const asPricing = (item: KosztorysItemT, settings: CatalogueComparisonSettingsT): ViewPricingT =>
  asViewPricing(item, { wTools: settings.wToolsCoeff, ownTools: settings.ownToolsCoeff })

const HINT_LIMIT = 3

export type HintCandidateT = { entry: WorkCatalogueItemT; pairs: Uint32Array }

// Folded and bigrammed ONCE for the whole cennik: `foldDescription` is ~45 split/join passes, and a
// 1000-row rozpiska against a few-hundred-row cennik would otherwise run it a million times.
export const hintCandidates = (catalogue: readonly WorkCatalogueItemT[]): HintCandidateT[] =>
  catalogue.map((entry) => ({ entry, pairs: bigrams(foldDescription(entry.description)) }))

export function closestEntries(
  description: string,
  candidates: readonly HintCandidateT[],
  limit = HINT_LIMIT,
): CatalogueHintT[] {
  const pairs = bigrams(foldDescription(description))
  return candidates
    .map(({ entry, pairs: candidatePairs }) => ({
      entry,
      score: diceSimilarity(pairs, candidatePairs),
    }))
    .filter((scored) => scored.score >= HINT_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ entry, score }) => ({
      id: entry.id,
      description: entry.description,
      descriptionTranslations: entry.descriptionTranslations,
      unit: entry.unit,
      clientPrice: entry.clientPrice,
      score,
    }))
}

type FigureSideT = { value: number; source: PriceSourceT; coeff: number | null }

const side = (value: number, source: PriceSourceT, coeff: number | null): FigureSideT => ({
  value,
  source,
  coeff,
})

const figure = (
  label: string,
  field: SeedConflictFieldT,
  kosztorys: FigureSideT,
  catalogue: FigureSideT,
): CatalogueFigureDiffT | null => {
  const sameKwota = roundToCents(kosztorys.value) === roundToCents(catalogue.value)
  if (sameKwota && kosztorys.source === catalogue.source && kosztorys.coeff === catalogue.coeff) {
    return null
  }
  return {
    label,
    field,
    kosztorys: kosztorys.value,
    catalogue: catalogue.value,
    delta: kosztorys.value - catalogue.value,
    kosztorysSource: kosztorys.source,
    catalogueSource: catalogue.source,
    kosztorysCoeff: kosztorys.coeff,
    catalogueCoeff: catalogue.coeff,
  }
}

// The cennik's „auto" is priced off the CENNIK's cena j.m. and the inwestycja's współczynnik. Never
// off the rozpiska row's own nadpisanie, which would make every auto row match itself.
const rateFigure = (
  pricing: ViewPricingT,
  entry: WorkCatalogueItemT,
  plane: ToolPlaneT,
  label: string,
  coeff: number,
): CatalogueFigureDiffT | null => {
  const entryRate = catalogueRateFor(entry, plane)
  const entrySource = catalogueSourceOf(entryRate)
  const rowSource = priceSourceOf(pricing, plane)
  if (rowSource === 'auto' && entrySource === 'auto') return null
  return figure(
    label,
    plane === 'w_tools' ? 'wToolsRate' : 'ownToolsRate',
    side(
      subcontractorPrice(pricing, plane),
      rowSource,
      rowSource === 'coeff' ? overrideCoeffFor(pricing, plane) : null,
    ),
    side(catalogueRateValue(entryRate, entry.clientPrice, coeff), entrySource, entryRate.coeff),
  )
}

// Every comparison is made on kwoty ROUNDED TO GROSZE, so the report disagrees exactly where the two
// numbers it renders disagree.
export function buildCatalogueComparison(
  items: readonly CatalogueComparisonItemT[],
  catalogue: readonly WorkCatalogueItemT[],
  settings: CatalogueComparisonSettingsT,
): CatalogueComparisonT {
  const index = indexCatalogue(catalogue)
  const keyCache = new Map<string, string>()
  const keyFor = (description: string, unit: string) => {
    // NUL, not a printable separator: an opis may contain any character an owner can type, and
    // („a|b", „c") would otherwise cache under the same key as („a", „b|c").
    const pair = `${description}\u0000${unit}`
    const cached = keyCache.get(pair)
    if (cached !== undefined) return cached
    const key = catalogueKey(description, unit)
    keyCache.set(pair, key)
    return key
  }
  const diffs: CataloguePriceDiffT[] = []
  const missing: CatalogueMissingT[] = []
  const entryByItemId = new Map<number, RowCatalogueEntryT>()
  let matching = 0

  for (const item of items) {
    const description = (item.description ?? '').trim()
    const unit = (item.unit ?? '').trim()
    if (!description) continue

    const entry = resolveCatalogueEntry(index, item.catalogueItemId, () =>
      keyFor(description, unit),
    )
    if (!entry) {
      missing.push({
        itemId: item.id,
        section: item.sectionName ?? '',
        description,
        unit,
        hints: [],
      })
      continue
    }
    // `?? null`: a katalog cached before the column existed has no `workNote` key at all.
    entryByItemId.set(item.id, { id: entry.id, note: entry.workNote ?? null })
    if (settings.linkedRowsAreCatalogue && item.catalogueItemId === entry.id) {
      matching += 1
      continue
    }

    const pricing = asPricing(item, settings)
    const figures = [
      figure(
        'Cena j.m.',
        'clientPrice',
        side(item.clientPrice, 'amount', null),
        side(entry.clientPrice, 'amount', null),
      ),
      rateFigure(pricing, entry, 'w_tools', RATE_LABELS.w_tools, settings.wToolsCoeff),
      rateFigure(pricing, entry, 'own_tools', RATE_LABELS.own_tools, settings.ownToolsCoeff),
    ].filter((diff) => diff !== null)

    if (figures.length === 0) {
      matching += 1
      continue
    }

    diffs.push({
      itemId: item.id,
      description,
      unit,
      clientPrice: item.clientPrice,
      figures,
      maxDelta: Math.max(...figures.map((diff) => Math.abs(diff.delta))),
    })
  }

  diffs.sort((left, right) => right.maxDelta - left.maxDelta)

  return { matching, diffs, missing, entryByItemId }
}

// Its own pass because it is the expensive half by two orders of magnitude: every praca is scored
// against every cennik opis, which on a few hundred pozycji against 843 wpisy is seconds, not
// milliseconds.
export function attachCatalogueHints(
  missing: readonly CatalogueMissingT[],
  catalogue: readonly WorkCatalogueItemT[],
): CatalogueMissingT[] {
  if (missing.length === 0) return []
  const candidates = hintCandidates(catalogue)
  return missing.map((row) => ({ ...row, hints: closestEntries(row.description, candidates) }))
}
