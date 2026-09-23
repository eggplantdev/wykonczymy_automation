import { MONEY_TOLERANCE, asViewPricing } from '@/lib/kosztorys/calc'
import {
  itemWithColumnDefaults,
  type StoredSnapshotPayloadT,
} from '@/lib/kosztorys/snapshot-format'
import type { PriceSourceT } from '@/lib/kosztorys/types'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  catalogueSourceOf,
  impliedCatalogueRate,
  type CatalogueRateT,
} from '@/lib/kosztorys/work-catalogue/catalogue-rate'
import { stripSectionOrdinal } from '@/lib/kosztorys/work-catalogue/section-category'
import type {
  CatalogueSeedItemT,
  SeedConflictFieldT,
  SeedConflictT,
  SeedOccurrenceT,
} from '@/lib/kosztorys/work-catalogue/types'

const GROSZ = 100

const toGrosz = (value: number): number => Math.round(value * GROSZ)

/**
 * The winner rule: the value that occurs MOST OFTEN, ties broken by the higher one.
 *
 * Not „the highest" — on the owner's szablon eight of the nine rozbieżności are one outlying sekcja
 * against three that agree to the grosz, so „highest wins" would import eight stale prices. Compared
 * in grosze because both stawki are computed (`clientPrice × coeff`), and float noise would otherwise
 * split one value into two near-identical buckets that each lose to a genuine minority.
 */
function winningBucket(values: readonly number[]): { value: number; count: number } {
  const counts = new Map<number, number>()
  for (const value of values) {
    const grosze = toGrosz(value)
    counts.set(grosze, (counts.get(grosze) ?? 0) + 1)
  }
  let winner = 0
  let winnerCount = -1
  for (const [grosze, count] of counts) {
    if (count > winnerCount || (count === winnerCount && grosze > winner)) {
      winner = grosze
      winnerCount = count
    }
  }
  return { value: winner / GROSZ, count: Math.max(winnerCount, 0) }
}

const winningValue = (values: readonly number[]): number => winningBucket(values).value

// Two stawki are „the same answer" only when they name the same ŹRÓDŁO and the same liczba — 0,65 as
// a mnożnik and 65 zł as a kwota stała are the same number today and different decisions tomorrow, so
// they must never share a bucket. Mnożniki are compared at four decimals, the precision the cell
// accepts; kwoty in grosze, like every other money comparison here.
const rateKey = ({ rate, coeff }: CatalogueRateT): string => {
  if (coeff !== null) return `coeff:${Math.round(coeff * 10000)}`
  if (rate !== null) return `amount:${toGrosz(rate)}`
  return 'auto'
}

// Mnożnik, then kwota, then auto — the same precedence the rozpiska reads sources in, used here only
// to break a COUNT tie. A decision beats „nobody decided", and between two decisions the mnożnik is
// the one that survives being placed into a rozpiska priced differently.
const RATE_RANK: Record<PriceSourceT, number> = { coeff: 2, amount: 1, auto: 0 }

/**
 * Same winner rule for a stawka, over the (źródło, liczba) pair rather than a bare number, because
 * „auto" is not the only non-kwota answer any more (EX-865).
 */
function winningRate(values: readonly CatalogueRateT[]): CatalogueRateT {
  const buckets = new Map<string, { value: CatalogueRateT; count: number }>()
  for (const value of values) {
    const key = rateKey(value)
    const bucket = buckets.get(key)
    if (bucket) bucket.count += 1
    else buckets.set(key, { value, count: 1 })
  }
  let winner: CatalogueRateT = { rate: null, coeff: null }
  let winnerCount = -1
  for (const { value, count } of buckets.values()) {
    const better =
      count > winnerCount ||
      (count === winnerCount &&
        RATE_RANK[catalogueSourceOf(value)] > RATE_RANK[catalogueSourceOf(winner)])
    if (better) {
      winner = value
      winnerCount = count
    }
  }
  return winner
}

const CONFLICT_FIELDS: readonly SeedConflictFieldT[] = ['clientPrice', 'wToolsRate', 'ownToolsRate']

// A difference of ŹRÓDŁO is a genuine rozbieżność — the szablon says two different things about how
// that plane is priced — so the comparison is over the bucket key, not over złotówki that two
// different źródła might coincide on.
const disagrees = (occurrences: readonly SeedOccurrenceT[], field: SeedConflictFieldT) => {
  if (field === 'clientPrice') {
    const first = occurrences[0].clientPrice
    return occurrences.some((o) => Math.abs(o.clientPrice - first) > MONEY_TOLERANCE)
  }
  const first = rateKey(occurrences[0][field])
  return occurrences.some((o) => rateKey(o[field]) !== first)
}

type GroupT = { description: string; unit: string; occurrences: SeedOccurrenceT[] }

/**
 * Turn a saved szablon into the cennik rows it implies, plus the rozbieżności it contains.
 *
 * Pure on purpose: the interesting behaviour is the winner rule over hundreds of real occurrences,
 * and that has to be assertable without a database. The script that writes the rows does the I/O.
 *
 * The szablon investment's global współczynniki take no part: only a plane carrying its OWN
 * nadpisanie is seeded at all, whether that nadpisanie is a kwota or a mnożnik. A plane without one
 * (137 of 373 prac on the current szablon) seeds as „auto" instead.
 */
export function buildCatalogueSeed(payload: StoredSnapshotPayloadT): {
  items: CatalogueSeedItemT[]
  conflicts: SeedConflictT[]
} {
  const sectionName = new Map(payload.sections.map((section) => [section.id, section.name]))

  const groups = new Map<string, GroupT>()
  for (const [index, stored] of payload.items.entries()) {
    const item = itemWithColumnDefaults(stored, index)
    const description = item.description?.trim()
    if (!description) continue
    const unit = item.unit?.trim() ?? ''
    const key = catalogueKey(description, unit)
    const group = groups.get(key) ?? { description, unit, occurrences: [] }
    group.occurrences.push({
      sectionName: stripSectionOrdinal(sectionName.get(item.sectionId) ?? ''),
      clientPrice: item.clientPrice,
      wToolsRate: impliedCatalogueRate(asViewPricing(item), 'w_tools'),
      ownToolsRate: impliedCatalogueRate(asViewPricing(item), 'own_tools'),
    })
    groups.set(key, group)
  }

  const items: CatalogueSeedItemT[] = []
  const conflicts: SeedConflictT[] = []

  for (const [matchKey, group] of groups) {
    const { occurrences } = group
    const clientPrice = winningValue(occurrences.map((o) => o.clientPrice))
    // The kategoria has no numeric winner rule of its own, so it follows the price: the first
    // occurrence that agrees with the winning „Cena j.m." is by construction one of the majority.
    const winner =
      occurrences.find((o) => Math.abs(o.clientPrice - clientPrice) <= MONEY_TOLERANCE) ??
      occurrences[0]

    const wTools = winningRate(occurrences.map((o) => o.wToolsRate))
    const ownTools = winningRate(occurrences.map((o) => o.ownToolsRate))
    items.push({
      description: group.description,
      category: winner.sectionName || null,
      unit: group.unit,
      clientPrice,
      wToolsRate: wTools.rate,
      wToolsRateCoeff: wTools.coeff,
      ownToolsRate: ownTools.rate,
      ownToolsRateCoeff: ownTools.coeff,
      matchKey,
    })

    const fields = CONFLICT_FIELDS.filter((field) => disagrees(occurrences, field))
    if (fields.length > 0)
      conflicts.push({ matchKey, description: group.description, fields, occurrences })
  }

  return { items, conflicts }
}
