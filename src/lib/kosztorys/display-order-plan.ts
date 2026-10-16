import { groupBySection } from '@/lib/kosztorys/row-ops'
import { sortRows, type SortDirT } from '@/lib/kosztorys/row-view'
import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Takes the FULL row set, never viewRows: the search box and „tylko rozjechane" narrow a section to
// the rows that matched, and reordering only those would interleave them with the rows the filter
// hid.
export function planKosztorysRenumber(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): { before: number[]; after: number[] } {
  const before: number[] = []
  const after: number[] = []
  for (const sectionRows of groupBySection(rows).values()) {
    for (const row of sectionRows) before.push(row.id)
    for (const row of sortRows(sectionRows, getValue, dir)) after.push(row.id)
  }
  return { before, after }
}
