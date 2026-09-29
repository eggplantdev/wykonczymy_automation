import { groupBySection } from '@/lib/kosztorys/row-ops'
import { makeSectionFooterRow, makeSectionHeaderRow } from '@/lib/kosztorys/synthetic-rows'
import type { KosztorysV2RowT, SectionMetaT } from '@/lib/kosztorys/types'

type OptsT = {
  collapsedSectionIds: ReadonlySet<number>
  // False under a sort scoped to the whole kosztorys: grouping presumes section-contiguous rows,
  // which such a sort breaks. Bands are then dropped entirely AND the collapsed set ignored — a
  // collapsed section with no band left to re-expand it would be rows the user can't get back.
  // A sort scoped to the sections keeps the rows contiguous, so the bands stay.
  enabled: boolean
  // Every section in display order, the itemless ones included — the list, not the filtered view, so
  // the sections keep their order regardless of which ones the filter thinned out.
  sections: readonly SectionMetaT[]
  // Off under search, filters and every client output: there a header with nothing under it is the
  // same noise as a section the filter emptied.
  showItemless: boolean
}

export function sectionRepresentatives(rows: readonly KosztorysV2RowT[]): KosztorysV2RowT[] {
  const bySection = new Map<number, KosztorysV2RowT>()
  for (const row of rows) if (!bySection.has(row.sectionId)) bySection.set(row.sectionId, row)
  return [...bySection.values()]
}

/**
 * A pozycja's number: its rank among the rows passed in, in display order.
 *
 * Never over a searched or sorted list — a number that renumbered itself as the reader typed would
 * name a different pozycja every keystroke. Which rows count is the caller's call: the owner's grid
 * passes the full dataset so a skipped number announces what a filter hid, the client's document
 * passes the rows it actually contains so the offer runs 1…N.
 */
export function baseOrdinals(rows: readonly KosztorysV2RowT[]): Map<number, number> {
  return new Map(rows.map((row, index) => [row.id, index + 1]))
}

/**
 * The grid's row list with one band opening each section and a totals band closing it.
 *
 * A section the filter emptied is dropped whole — band, sum and all. A header over a footer with
 * nothing between says only „tu nic nie ma", and a strict filter (five hits across a dozen sections)
 * would bury its own results under eleven such frames.
 */
export function buildSectionBandRows(
  viewRows: KosztorysV2RowT[],
  { collapsedSectionIds, enabled, sections, showItemless }: OptsT,
): KosztorysV2RowT[] {
  if (!enabled) return viewRows

  const bySection = groupBySection(viewRows)

  const rows: KosztorysV2RowT[] = []
  for (const section of sections) {
    const group = bySection.get(section.sectionId)
    if (!group) {
      // Its sum is zero by construction, so the footer would only restate that.
      if (showItemless) rows.push(makeSectionHeaderRow(section))
      continue
    }
    bySection.delete(section.sectionId)
    rows.push(makeSectionHeaderRow(section))
    // A collapsed section shows its header alone: the footer sums the rows it hides, so it goes
    // with them.
    if (collapsedSectionIds.has(section.sectionId)) continue
    rows.push(...group, makeSectionFooterRow(section))
  }
  // A row whose section the list never named would otherwise vanish from the grid — render it
  // bandless rather than drop it.
  for (const orphans of bySection.values()) rows.push(...orphans)
  return rows
}
