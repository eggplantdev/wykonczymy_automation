import type { SectionMetaT } from '@/lib/kosztorys/types'

export type SectionTargetT = { kind: 'existing'; sectionId: number } | { kind: 'new'; name: string }

// The CLIENT copy of the server's `lower(btrim(name))` — it must fold exactly what Postgres folds and
// nothing more.
const sqlNameKey = (name: string) => name.trim().toLowerCase()

// The combobox keys its list by the option string itself, so a repeated name would render two
// identical rows under one React key.
export function sectionNameOptions(sections: readonly SectionMetaT[]): string[] {
  const seen = new Set<string>()
  return sections.flatMap((section) => {
    const key = sqlNameKey(section.sectionName)
    if (key.length === 0 || seen.has(key)) return []
    seen.add(key)
    return section.sectionName
  })
}

// `preferredSectionId` is the sekcja the picker was opened FROM: with two sekcje of one name,
// matching by name alone would silently move the prace into the first twin, even though the owner
// opened the picker inside the second.
export function resolveSectionTarget(
  name: string,
  sections: readonly SectionMetaT[],
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
