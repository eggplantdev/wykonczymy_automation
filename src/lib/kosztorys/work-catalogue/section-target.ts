import type { SectionSubtotalT } from '@/lib/kosztorys/types'

// `undefined` means the picker has no target at all — the name is blank — and „Dodaj" stays disabled.
export type SectionTargetT = { kind: 'existing'; sectionId: number } | { kind: 'new'; name: string }

// The name is the sekcja's identity (owner's ruling 2026-09-22), and this is the CLIENT copy of the
// server's `lower(btrim(name))` — it must fold exactly what Postgres folds and nothing more. Neither
// `foldText` (strips diacritics, for search) nor `catalogueKey`'s `foldDescription` fits: either
// would match „Łazienka" to „Lazienka" here, the client would report an existing sekcja, and the
// server's SELECT would miss and mint the twin this whole path exists to prevent.
const sqlNameKey = (name: string) => name.trim().toLowerCase()

// The combobox keys its list by the option string itself, so a repeated name would render two
// identical rows under one React key. First occurrence wins — which is also the sekcja
// `resolveSectionTarget` picks, so the list and the write agree on which twin is reachable.
export function sectionNameOptions(sections: readonly SectionSubtotalT[]): string[] {
  const seen = new Set<string>()
  return sections.flatMap((section) => {
    const key = sqlNameKey(section.sectionName)
    if (key.length === 0 || seen.has(key)) return []
    seen.add(key)
    return section.sectionName
  })
}

/**
 * `preferredSectionId` is the sekcja the picker was opened FROM (a row's menu). It wins over the
 * name match while the name is still that sekcja's own: with two sekcje of one name, matching by
 * name alone would silently move the prace into the first twin, even though the owner opened the
 * picker inside the second.
 *
 * A miss is not an error — it is the „nowa sekcja" case.
 */
export function resolveSectionTarget(
  name: string,
  sections: readonly SectionSubtotalT[],
  preferredSectionId?: number,
): SectionTargetT | undefined {
  const key = sqlNameKey(name)
  if (key.length === 0) return undefined

  const preferred = sections.find((section) => section.sectionId === preferredSectionId)
  if (preferred && sqlNameKey(preferred.sectionName) === key)
    return { kind: 'existing', sectionId: preferred.sectionId }

  const match = sections.find((section) => sqlNameKey(section.sectionName) === key)
  return match
    ? { kind: 'existing', sectionId: match.sectionId }
    : { kind: 'new', name: name.trim() }
}
