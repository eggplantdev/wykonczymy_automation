import type { PriceViewT } from '@/lib/kosztorys/calc'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { applyRowConditions } from '@/lib/kosztorys/row-conditions/queries'
import { sortValueGetter } from '@/lib/kosztorys/columns/sort-value'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

export function filterRows(rows: KosztorysV2RowT[], query: string): KosztorysV2RowT[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      (r.description ?? '').toLowerCase().includes(q) ||
      r.sectionName.toLowerCase().includes(q) ||
      (r.unit ?? '').toLowerCase().includes(q),
  )
}

export type SortDirT = 'asc' | 'desc'

export type SortScopeT = 'section' | 'global'

export type SortPickT = { dir: SortDirT; scope: SortScopeT }
export type SortStateT = ({ field: string } & SortPickT) | null

export function activeSortPick(sort: SortStateT | undefined, field: string): SortPickT | null {
  return sort?.field === field ? { dir: sort.dir, scope: sort.scope } : null
}

// Nulls sink to the bottom under BOTH directions — `sign` deliberately does not touch that branch, or
// "desc" would float them up.
export function sortRows(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): KosztorysV2RowT[] {
  const sign = dir === 'asc' ? 1 : -1
  const decorated = rows.map((row) => ({ row, key: getValue(row) }))
  decorated.sort((a, b) => {
    if (a.key == null || b.key == null) {
      if (a.key == null && b.key == null) return 0
      return a.key == null ? 1 : -1
    }
    if (typeof a.key === 'string' || typeof b.key === 'string') {
      return sign * String(a.key).localeCompare(String(b.key), 'pl')
    }
    return sign * (a.key - b.key)
  })
  return decorated.map((d) => d.row)
}

export function sortRowsWithinSections(
  rows: KosztorysV2RowT[],
  getValue: (row: KosztorysV2RowT) => string | number | null,
  dir: SortDirT,
): KosztorysV2RowT[] {
  return [...groupBySection(rows).values()].flatMap((group) => sortRows(group, getValue, dir))
}

export function buildViewRows(input: {
  rows: KosztorysV2RowT[]
  search: string
  engagedConditionIds: ReadonlySet<string>
  sort: SortStateT
  view: PriceViewT
  stages: KosztorysStageT[]
  hasSettledMaterial: boolean
  divergentPriceRowIds: ReadonlySet<number>
  qtyDoneByRowId?: ReadonlyMap<number, number>
  catalogueRowIds?: { divergent: ReadonlySet<number>; missing: ReadonlySet<number> }
  latchedRowIds?: ReadonlySet<number>
  hasAiDraft?: boolean
  aiColumnsShown?: boolean
}): KosztorysV2RowT[] {
  const {
    rows,
    search,
    engagedConditionIds,
    sort,
    view,
    stages,
    hasSettledMaterial,
    divergentPriceRowIds,
    qtyDoneByRowId,
    catalogueRowIds,
    latchedRowIds,
    hasAiDraft,
    aiColumnsShown,
  } = input
  // The latch bypasses the conditions only — a pozycja held open for editing still leaves the grid
  // when the search stops matching it
  const filtered = applyRowConditions(
    filterRows(rows, search),
    engagedConditionIds,
    {
      stages,
      hasSettledMaterial,
      divergentPriceRowIds,
      qtyDoneByRowId,
      catalogueRowIds,
      hasAiDraft,
      aiColumnsShown,
    },
    latchedRowIds,
  )
  if (!sort) return filtered
  const getValue = sortValueGetter(sort.field, view, stages)
  return sort.scope === 'global'
    ? sortRows(filtered, getValue, sort.dir)
    : sortRowsWithinSections(filtered, getValue, sort.dir)
}
