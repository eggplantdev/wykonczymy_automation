import { groupBySection } from '@/lib/kosztorys/row-ops'
import type { KosztorysTreeT, KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'
import { regroupByKeys } from '@/lib/utils/group-in-order'

// The editor's section list — the one source of section order, name and colour. `rows` holds pozycje
// only, so a section with none exists here and nowhere else.
export function treeToSections(tree: Pick<KosztorysTreeT, 'sections'>): SectionMetaT[] {
  return tree.sections.map((section) => ({
    sectionId: section.id,
    sectionName: section.name,
    sectionColor: section.color,
  }))
}

// A null anchor prepends — where addSectionAction puts a new section. An unknown anchor appends.
export function insertSection(
  sections: readonly SectionMetaT[],
  meta: SectionMetaT,
  anchorId: number | null,
  dir: 'above' | 'below' = 'above',
): SectionMetaT[] {
  if (anchorId === null) return [meta, ...sections]
  const anchorAt = sections.findIndex((section) => section.sectionId === anchorId)
  const at = anchorAt < 0 ? sections.length : dir === 'above' ? anchorAt : anchorAt + 1
  return [...sections.slice(0, at), meta, ...sections.slice(at)]
}

// `index` is where the section stood, so a rejected delete can put it back exactly there.
export function removeSection(
  sections: readonly SectionMetaT[],
  sectionId: number,
): { next: SectionMetaT[]; index: number } {
  return {
    next: sections.filter((section) => section.sectionId !== sectionId),
    index: sections.findIndex((section) => section.sectionId === sectionId),
  }
}

export function restoreSection(
  sections: readonly SectionMetaT[],
  meta: SectionMetaT,
  index: number,
): SectionMetaT[] {
  if (sections.some((section) => section.sectionId === meta.sectionId)) return [...sections]
  const at = index < 0 ? sections.length : Math.min(index, sections.length)
  return [...sections.slice(0, at), meta, ...sections.slice(at)]
}

export function patchSection(
  sections: readonly SectionMetaT[],
  sectionId: number,
  patch: Partial<Omit<SectionMetaT, 'sectionId'>>,
): SectionMetaT[] {
  return sections.map((section) =>
    section.sectionId === sectionId ? { ...section, ...patch } : section,
  )
}

// Rows re-laid as contiguous blocks in section-list order: numbering, subtotal order and the
// „Zapisz kolejność" plan all read the order off `rows`. A row whose section the list doesn't name
// keeps its relative order at the end rather than vanishing.
export function orderRowsBySections(
  rows: KosztorysV2RowT[],
  sections: readonly SectionMetaT[],
): KosztorysV2RowT[] {
  const blocks = groupBySection(rows)
  const listed = sections.map((section) => section.sectionId)
  const known = new Set(listed)
  const orphans = [...blocks.keys()].filter((sectionId) => !known.has(sectionId))
  return regroupByKeys(blocks, [...listed, ...orphans])
}
