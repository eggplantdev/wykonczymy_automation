import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { TYPO_FIXES } from '@/lib/kosztorys/clean-description'
import { fold } from './columns'

// The subset of a praca `keyItems` reads. Widened from `KosztorysItemT` so callers holding a
// half-built praca (the parsed sheet rows, which have no override fields yet) need no cast.
type KeyableItemT = { sectionId: number; description: string | null }

// „Popraw literówki w opisie prac" rewrites LETTERS, which `fold()` cannot absorb — so without the
// same fixes here the cleaner costs every praca it touches its identity: it stops matching its twin
// in the sheet and the import treats it as a praca the sheet doesn't have.
//
// The rules are folded rather than the text run through `cleanDescription`, which fixes spelling
// BEFORE it un-shouts — a SHOUTED opis would never match a lowercase fix, and the two sides would
// diverge on case alone. Folding sidesteps the ordering and drops the diacritics-only rules.
//
// The edge spaces are re-attached because `fold()` trims: ` parc` → ` prac` is a word-boundary rule,
// and without its leading space it rewrites „parcie gruntu" into „pracie gruntu".
const foldRule = (rule: string) =>
  (/^\s/.test(rule) ? ' ' : '') + fold(rule) + (/\s$/.test(rule) ? ' ' : '')

const FOLDED_TYPO_FIXES = TYPO_FIXES.map(
  ([from, to]) => [foldRule(from), foldRule(to)] as const,
).filter(([from, to]) => from !== to)

// The same split for the katalog's whole-name corrections: identity gets only the entries fold
// cannot already equate. An entry whose fold is its own key is a no-op here and a chain waiting to
// happen.
const FOLDED_CATALOGUE_NAME_FIXES = new Map(
  [...CATALOGUE_NAME_FIXES]
    .map(([from, to]) => [from, fold(to)] as const)
    .filter(([from, to]) => from !== to),
)

export function foldDescription(description: string | null): string {
  // Substring rules run first because the table's keys were computed with them already applied
  // (`61ae1aa5`), so a name only reaches its entry on the far side of that reduce.
  const spelled = FOLDED_TYPO_FIXES.reduce(
    (text, [from, to]) => text.split(from).join(to),
    fold(description),
  )
  return FOLDED_CATALOGUE_NAME_FIXES.get(spelled) ?? spelled
}

// Ids can't carry a praca's identity across a re-import — the sheet has none — and the row number
// can't either, since inserting one praca would re-key every praca below it.
export const itemKey = (section: string, description: string | null, occurrence: number): string =>
  `${fold(section)}|${foldDescription(description)}#${occurrence}`

export function keyItems<ItemT extends KeyableItemT>(
  items: readonly ItemT[],
  sectionName: (item: ItemT) => string,
): Map<string, ItemT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, ItemT>()
  for (const item of items) {
    const base = `${fold(sectionName(item))}|${foldDescription(item.description)}`
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    byKey.set(`${base}#${occurrence}`, item)
  }
  return byKey
}
