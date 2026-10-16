import { groupBySection } from '@/lib/kosztorys/row-ops'
import { makeSectionFooterRow, makeSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // Bands are then dropped entirely AND the collapsed set ignored — a collapsed section with no band
  // left to re-expand it would be rows the user can't get back.
  enabled: boolean
  sections: readonly SectionMetaT[]
  showItemless: boolean
}

/**
 * Never over a searched or sorted list — a number that renumbered itself as the reader typed would
 * name a different pozycja every keystroke.
 */
export function baseOrdinals(rows: readonly KosztorysV2RowT[]): Map<number, number> {
  return new Map(rows.map((row, index) => [row.id, index + 1]))
}

export function buildSectionBandRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled, sections, showItemless }: OptsT,
): KosztorysV2RowT[] {
  // With no rows there is nothing for the sort to scatter, and dropping the bands would leave an
  // all-itemless kosztorys as a blank grid with no „Dodaj pracę" to start it from.
  if (!enabled && viewRows.length > 0) return viewRows

  const bySection = groupBySection(viewRows)

  const rows: KosztorysV2RowT[] = []
  for (const section of sections) {
    const group = bySection.get(section.sectionId)
    if (!group) {
      if (showItemless) rows.push(makeSectionHeaderRow(section))
      continue
    }
    bySection.delete(section.sectionId)
    rows.push(makeSectionHeaderRow(section))
    if (collapsedSectionIds.has(section.sectionId)) continue
    rows.push(...group, makeSectionFooterRow(section))
  }
  for (const orphans of bySection.values()) rows.push(...orphans)
  return rows
}
