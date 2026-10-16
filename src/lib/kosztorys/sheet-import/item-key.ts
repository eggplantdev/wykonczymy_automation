import { fold } from '@/lib/kosztorys/fold'
import { CATALOGUE_NAME_FIXES } from '@/lib/kosztorys/catalogue-name-fixes'
import { TYPO_FIXES } from '@/lib/kosztorys/clean-description'

type KeyableItemT = { sectionId: number; description: string | null }

// „Popraw literówki w opisie prac" rewrites LETTERS, which `fold()` cannot absorb — so without the
// same fixes here the cleaner costs every praca it touches its identity: it stops matching its twin
// in the sheet and the import treats it as a praca the sheet doesn't have.
//
// The edge spaces are re-attached because `fold()` trims: ` parc` → ` prac` is a word-boundary rule,
// and without its leading space it rewrites „parcie gruntu" into „pracie gruntu".
const foldRule = (rule: string) =>
  (/^\s/.test(rule) ? ' ' : '') + fold(rule) + (/\s$/.test(rule) ? ' ' : '')

const FOLDED_TYPO_FIXES = TYPO_FIXES.map(
  ([from, to]) => [foldRule(from), foldRule(to)] as const,
).filter(([from, to]) => from !== to)

const FOLDED_CATALOGUE_NAME_FIXES = new Map(
  [...CATALOGUE_NAME_FIXES]
    .map(([from, to]) => [from, fold(to)] as const)
    .filter(([from, to]) => from !== to),
)

export function foldDescription(description: string | null): string {
  // Substring rules run first because the table's keys were computed with them already applied
  const spelled = FOLDED_TYPO_FIXES.reduce(
    (text, [from, to]) => text.split(from).join(to),
    fold(description),
  )
  return FOLDED_CATALOGUE_NAME_FIXES.get(spelled) ?? spelled
}

// Ids can't carry a praca's identity across a re-import — the sheet has none — and the row number
// can't either, since inserting one praca would re-key every praca below it.
export const sectionItemKey = (section: string, description: string | null): string =>
  `${fold(section)}|${foldDescription(description)}`

export const itemKey = (section: string, description: string | null, occurrence: number): string =>
  `${sectionItemKey(section, description)}#${occurrence}`

export function keyItems<ItemT extends KeyableItemT>(
  items: readonly ItemT[],
  sectionName: (item: ItemT) => string,
): Map<string, ItemT> {
  const seen = new Map<string, number>()
  const byKey = new Map<string, ItemT>()
  for (const item of items) {
    const base = sectionItemKey(sectionName(item), item.description)
    const occurrence = seen.get(base) ?? 0
    seen.set(base, occurrence + 1)
    byKey.set(`${base}#${occurrence}`, item)
  }
  return byKey
}
