import {
  MONEY_TOLERANCE,
  asViewPricing,
  overrideValueFor,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import type { KosztorysItemT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import type {
  CatalogueComparisonItemT,
  CatalogueComparisonSettingsT,
  CatalogueComparisonT,
  CatalogueFigureDiffT,
  CatalogueMissingT,
  CataloguePriceDiffT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { bigrams, diceSimilarity } from '@/lib/utils/string-similarity'

// Below this the two names have nothing to do with each other and a hint would be noise — an owner
// who reads „może chodzi o…" over an unrelated praca stops reading the hints at all.
const HINT_THRESHOLD = 0.55

const asPricing = (item: KosztorysItemT, settings: CatalogueComparisonSettingsT): ViewPricingT =>
  asViewPricing(item, { wTools: settings.wToolsCoeff, ownTools: settings.ownToolsCoeff })

// An „auto" cennik stawka is compared as the kwota it implies FOR THIS INWESTYCJA. The base is the
// CENNIK's cena j.m. and the inwestycja's współczynnik — never the rozpiska row's own nadpisanie,
// which says nothing about what the cennik holds and would make every auto row match itself.
const catalogueRate = (rate: number | null, clientPrice: number, coeff: number): number =>
  rate ?? clientPrice * coeff

type HintCandidateT = { description: string; pairs: string[] }

// Folded and bigrammed ONCE for the whole cennik: `foldDescription` is ~45 split/join passes, and a
// 1000-row rozpiska against a few-hundred-row cennik would otherwise run it a million times.
const hintCandidates = (catalogue: readonly WorkCatalogueItemT[]): HintCandidateT[] =>
  catalogue.map((entry) => ({
    description: entry.description,
    pairs: bigrams(foldDescription(entry.description)),
  }))

function closestDescription(description: string, candidates: readonly HintCandidateT[]) {
  const pairs = bigrams(foldDescription(description))
  let best: { description: string; score: number } | null = null
  for (const candidate of candidates) {
    const score = diceSimilarity(pairs, candidate.pairs)
    if (!best || score > best.score) best = { description: candidate.description, score }
  }
  return best && best.score >= HINT_THRESHOLD ? best.description : null
}

const figure = (
  label: string,
  kosztorys: number,
  catalogue: number,
): CatalogueFigureDiffT | null => {
  const delta = kosztorys - catalogue
  return Math.abs(delta) > MONEY_TOLERANCE ? { label, kosztorys, catalogue, delta } : null
}

/**
 * A stawka, but silent when both sides are „auto". There both kwoty ARE `cena × ten sam
 * współczynnik`, so their difference is the cena difference wearing a second and third hat —
 * reporting it turns one rozjazd into three and inflates both the count and `maxDelta`. A
 * nadpisanie on either side makes the stawka a fact of its own again, and then it is reported.
 */
const rateFigure = (
  pricing: ViewPricingT,
  entry: WorkCatalogueItemT,
  plane: ToolPlaneT,
  label: string,
  coeff: number,
): CatalogueFigureDiffT | null => {
  const entryRate = plane === 'w_tools' ? entry.wToolsRate : entry.ownToolsRate
  if (overrideValueFor(pricing, plane) === null && entryRate === null) return null
  return figure(
    label,
    subcontractorPrice(pricing, plane),
    catalogueRate(entryRate, entry.clientPrice, coeff),
  )
}

/**
 * The rozpiska against the cennik: which prace agree, which disagree on money, which the cennik has
 * never heard of. Reports, never writes — the two are allowed to differ, and this only says where.
 *
 * Compares all three liczby, because a praca can carry the offered cena and still pay the
 * podwykonawca something else entirely — the stawki are exactly where a szablon goes stale. Every
 * comparison is at `MONEY_TOLERANCE`: a stawka derived as `cena × współczynnik` never equals the
 * frozen kwota to the last float bit, and a report that flagged that would flag every single row.
 */
export function buildCatalogueComparison(
  items: readonly CatalogueComparisonItemT[],
  catalogue: readonly WorkCatalogueItemT[],
  settings: CatalogueComparisonSettingsT,
): CatalogueComparisonT {
  const byKey = new Map(catalogue.map((entry) => [entry.matchKey, entry]))
  // The same praca recurs across sekcje under the same name — a 379-pozycja rozpiska carries only
  // ~198 distinct (opis, j.m.) pairs — so fold each pair once. This runs on every committed
  // keystroke, where `catalogueKey` is the whole cost.
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
  let matching = 0

  for (const item of items) {
    const description = (item.description ?? '').trim()
    const unit = (item.unit ?? '').trim()
    // A praca with no name is a blank line the owner has not filled in yet, not a rozjazd.
    if (!description) continue

    const entry = byKey.get(keyFor(description, unit))
    if (!entry) {
      // `hint` is filled in by `attachCatalogueHints`, never here — see its docblock.
      missing.push({
        itemId: item.id,
        section: item.sectionName ?? '',
        description,
        unit,
        hint: null,
      })
      continue
    }

    const pricing = asPricing(item, settings)
    const figures = [
      figure('Cena j.m.', item.clientPrice, entry.clientPrice),
      rateFigure(pricing, entry, 'w_tools', 'Stawka z narzędziami', settings.wToolsCoeff),
      rateFigure(pricing, entry, 'own_tools', 'Stawka bez narzędzi', settings.ownToolsCoeff),
    ].filter((diff) => diff !== null)

    if (figures.length === 0) {
      matching += 1
      continue
    }

    diffs.push({
      itemId: item.id,
      description,
      unit,
      figures,
      maxDelta: Math.max(...figures.map((diff) => Math.abs(diff.delta))),
    })
  }

  diffs.sort((left, right) => right.maxDelta - left.maxDelta)

  return { matching, diffs, missing }
}

/**
 * The „może chodzi o…" guesses, attached to a finished „brak w katalogu" list.
 *
 * Its own pass because it is the expensive half by two orders of magnitude: every praca is scored
 * against every cennik opis, which on a few hundred pozycji against 843 wpisy is seconds, not
 * milliseconds. The classification above runs on every committed keystroke; this runs when somebody
 * opens the report and reads it.
 */
export function attachCatalogueHints(
  missing: readonly CatalogueMissingT[],
  catalogue: readonly WorkCatalogueItemT[],
): CatalogueMissingT[] {
  if (missing.length === 0) return []
  const candidates = hintCandidates(catalogue)
  return missing.map((row) => ({ ...row, hint: closestDescription(row.description, candidates) }))
}
