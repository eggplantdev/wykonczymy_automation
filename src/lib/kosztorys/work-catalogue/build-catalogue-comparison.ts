import {
  asViewPricing,
  overrideCoeffFor,
  priceSourceOf,
  subcontractorPrice,
} from '@/lib/kosztorys/calc'
import { RATE_LABELS } from '@/lib/kosztorys/constants'
import type { KosztorysItemT, PriceSourceT, ToolPlaneT, ViewPricingT } from '@/lib/kosztorys/types'
import { foldDescription } from '@/lib/kosztorys/sheet-import/item-key'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  catalogueRateFor,
  catalogueRateValue,
  catalogueSourceOf,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import type {
  CatalogueComparisonItemT,
  CatalogueComparisonSettingsT,
  CatalogueComparisonT,
  CatalogueFigureDiffT,
  CatalogueHintT,
  CatalogueMissingT,
  CataloguePriceDiffT,
  SeedConflictFieldT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'
import { roundToCents } from '@/lib/utils/round-to-cents'
import { bigrams, diceSimilarity } from '@/lib/utils/string-similarity'

// Below this the two names have nothing to do with each other and a hint would be noise — an owner
// who reads „może chodzi o…" over an unrelated praca stops reading the hints at all.
const HINT_THRESHOLD = 0.55

const asPricing = (item: KosztorysItemT, settings: CatalogueComparisonSettingsT): ViewPricingT =>
  asViewPricing(item, { wTools: settings.wToolsCoeff, ownTools: settings.ownToolsCoeff })

const HINT_LIMIT = 3

type HintCandidateT = { entry: WorkCatalogueItemT; pairs: string[] }

// Folded and bigrammed ONCE for the whole cennik: `foldDescription` is ~45 split/join passes, and a
// 1000-row rozpiska against a few-hundred-row cennik would otherwise run it a million times.
const hintCandidates = (catalogue: readonly WorkCatalogueItemT[]): HintCandidateT[] =>
  catalogue.map((entry) => ({ entry, pairs: bigrams(foldDescription(entry.description)) }))

// Scores everything and sorts, rather than keeping a running top-3: the loop already touches every
// wpis (there is no ordering to short-circuit on), and a few hundred kept candidates is nothing
// beside the scoring itself — which is what the caller's lazy pass exists to pay for.
function closestEntries(
  description: string,
  candidates: readonly HintCandidateT[],
  limit = HINT_LIMIT,
): CatalogueHintT[] {
  const pairs = bigrams(foldDescription(description))
  return candidates
    .map(({ entry, pairs: candidatePairs }) => ({
      id: entry.id,
      description: entry.description,
      unit: entry.unit,
      clientPrice: entry.clientPrice,
      score: diceSimilarity(pairs, candidatePairs),
    }))
    .filter((hint) => hint.score >= HINT_THRESHOLD)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

// One side of a rozjazd: the kwota, and how that kwota came to be. The mnożnik rides along because a
// pair of stawek can agree to the grosz while naming different mnożniki — same money today, and one
// of them moves the next time the cena j.m. does.
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
  // Raw, not rounded: `formatPLN` rounds it for display anyway, and the sort key wants the real gap.
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

/**
 * A stawka, but silent when both sides are „auto". There both kwoty ARE `cena × ten sam
 * współczynnik`, so their difference is the cena difference wearing a second and third hat —
 * reporting it turns one rozjazd into three and inflates both the count and `maxDelta`. A nadpisanie
 * on either side — kwota stała or własny mnożnik — makes the stawka a fact of its own again, and then
 * it is reported.
 *
 * The cennik's „auto" is priced off the CENNIK's cena j.m. and the inwestycja's współczynnik; its
 * mnożnik off the cennik's cena too. Never off the rozpiska row's own nadpisanie, which says nothing
 * about what the cennik holds and would make every auto row match itself.
 */
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

/**
 * The rozpiska against the cennik: which prace agree, which disagree on money, which the cennik has
 * never heard of. Reports, never writes — the two are allowed to differ, and this only says where.
 *
 * Compares all three liczby, because a praca can carry the offered cena and still pay the
 * podwykonawca something else entirely — the stawki are exactly where a szablon goes stale. Every
 * comparison is made on kwoty ROUNDED TO GROSZE, so the report disagrees exactly where the two
 * numbers it renders disagree. A stawka derived as `cena × współczynnik` carries a float residue no
 * column ever shows, and a threshold set at half a grosz decides a half-grosz gap on that residue —
 * which is how „14,88 zł against 14,88 zł, różnica −0,01 zł" reached the owner's screen. A stawka
 * also disagrees on ŹRÓDŁO: a frozen kwota against a katalog „auto" is a rozjazd at any kwota,
 * because taking the katalog's answer there means dropping the nadpisanie rather than copying a
 * number — and the same holds for a kwota against a mnożnik, which agree today and part company the
 * moment the cena j.m. moves.
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
      // `hints` are filled in by `attachCatalogueHints`, never here — see its docblock.
      missing.push({
        itemId: item.id,
        section: item.sectionName ?? '',
        description,
        unit,
        hints: [],
      })
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
  return missing.map((row) => ({ ...row, hints: closestEntries(row.description, candidates) }))
}
