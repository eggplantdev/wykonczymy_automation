import type { UsedKosztorysItemT } from '@/lib/db/catalogue-usage'
import {
  closestEntries,
  hintCandidates,
} from '@/lib/kosztorys/work-catalogue/build-catalogue-comparison'
import { catalogueKey } from '@/lib/kosztorys/work-catalogue/catalogue-key'
import {
  indexCatalogue,
  resolveCatalogueEntry,
} from '@/lib/kosztorys/work-catalogue/resolve-catalogue-entry'
import type {
  CatalogueUsageT,
  UncataloguedUsageT,
  WorkCatalogueItemT,
} from '@/lib/kosztorys/work-catalogue/types'

// The folded opis half of a klucz — the j.m. is always the segment after the last „|".
const descriptionPart = (key: string) => key.slice(0, key.lastIndexOf('|'))

type GroupT = { investments: Set<number>; spellings: Map<string, number> }

const SPELLING_SEPARATOR = '\u0000'

function mostFrequentSpelling(spellings: Map<string, number>): {
  description: string
  unit: string
} {
  let best = ''
  let bestCount = -1
  for (const [spelling, count] of spellings) {
    if (count > bestCount) {
      best = spelling
      bestCount = count
    }
  }
  const [description = '', unit = ''] = best.split(SPELLING_SEPARATOR)
  return { description, unit }
}

/**
 * The remembered praca, else an exact klucz match — the count is a fact about the cennik, and a „może chodzi o…" guess
 * counted into it would make the figure depend on a similarity threshold. The unit is distinct
 * inwestycje: twenty pozycje of one praca in one łazienka are still one kosztorys using it.
 */
export function buildCatalogueUsage(
  used: readonly UsedKosztorysItemT[],
  catalogue: readonly WorkCatalogueItemT[],
): CatalogueUsageT {
  // A pozycja that remembers its praca counts under that praca's klucz, whatever its own opis now
  // says — so a praca renamed in the katalog keeps its count instead of reappearing as uncatalogued.
  const index = indexCatalogue(catalogue)
  const groups = new Map<string, GroupT>()
  for (const item of used) {
    const ownKey = () => catalogueKey(item.description, item.unit)
    const key = resolveCatalogueEntry(index, item.catalogueItemId, ownKey)?.matchKey ?? ownKey()
    let group = groups.get(key)
    if (!group) {
      group = { investments: new Set(), spellings: new Map() }
      groups.set(key, group)
    }
    group.investments.add(item.investmentId)
    const spelling = `${item.description}${SPELLING_SEPARATOR}${item.unit ?? ''}`
    group.spellings.set(spelling, (group.spellings.get(spelling) ?? 0) + 1)
  }

  const byId: Record<number, number> = {}
  for (const entry of catalogue) {
    const group = groups.get(entry.matchKey)
    if (group) byId[entry.id] = group.investments.size
  }

  const usedDescriptions = new Map<string, Set<string>>()
  for (const key of groups.keys()) {
    const description = descriptionPart(key)
    const keys = usedDescriptions.get(description) ?? new Set()
    keys.add(key)
    usedDescriptions.set(description, keys)
  }
  const otherUnitIds = catalogue
    .filter((entry) =>
      [...(usedDescriptions.get(descriptionPart(entry.matchKey)) ?? [])].some(
        (key) => key !== entry.matchKey,
      ),
    )
    .map((entry) => entry.id)

  const catalogued = new Set(catalogue.map((entry) => entry.matchKey))
  const candidates = hintCandidates(catalogue)
  const uncatalogued: UncataloguedUsageT[] = [...groups]
    .filter(([key]) => !catalogued.has(key))
    .map(([key, group]) => {
      const { description, unit } = mostFrequentSpelling(group.spellings)
      return {
        key,
        description,
        unit,
        kosztorysCount: group.investments.size,
        hints: closestEntries(description, candidates),
      }
    })
    .sort(
      (left, right) =>
        right.kosztorysCount - left.kosztorysCount ||
        left.description.localeCompare(right.description, 'pl'),
    )

  return { byId, otherUnitIds, uncatalogued }
}
