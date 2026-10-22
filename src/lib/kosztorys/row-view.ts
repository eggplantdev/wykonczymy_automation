import type { PriceViewT } from '@/lib/kosztorys/calc'
import { groupBySection } from '@/lib/kosztorys/row-ops'
import { applyRowConditions } from '@/lib/kosztorys/row-conditions/queries'
import { sortValueGetter } from '@/lib/kosztorys/columns/sort-value'
import type { KosztorysStageT, KosztorysV2RowT } from '@/lib/kosztorys/types'

// What the view showed at the last deliberate action (a sort pick, a new search phrase, a condition
// toggle). Cells write per keystroke and the grid keeps its cursor by index, so a row that leaves or
// moves mid-edit hands the next keystroke to another pozycja.
export type ViewLatchT = { ids: ReadonlySet<number>; rank: ReadonlyMap<number, number> }

export function filterRows(
  rows: KosztorysV2RowT[],
  query: string,
  latchedIds?: ReadonlySet<number>,
): KosztorysV2RowT[] {
  const q = query.trim().toLowerCase()
  if (!q) return rows
  return rows.filter(
    (r) =>
      latchedIds?.has(r.id) ||
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

// Unranked rows (a new pozycja, an undo) keep their fresh order after the ranked ones, so they join at
// the end instead of landing inside the frozen order.
function inFrozenOrder(
  rows: KosztorysV2RowT[],
  rank: ReadonlyMap<number, number>,
): KosztorysV2RowT[] {
  const ranked = rows
    .filter((row) => rank.has(row.id))
    .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0))
  return [...ranked, ...rows.filter((row) => !rank.has(row.id))]
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
  latch?: ViewLatchT
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
    latch,
    hasAiDraft,
    aiColumnsShown,
  } = input
  const filtered = applyRowConditions(
    filterRows(rows, search, latch?.ids),
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
    latch?.ids,
  )
  if (!sort) return filtered
  const getValue = sortValueGetter(sort.field, view, stages)
  if (sort.scope === 'global') {
    const sorted = sortRows(filtered, getValue, sort.dir)
    return latch ? inFrozenOrder(sorted, latch.rank) : sorted
  }
  const sorted = sortRowsWithinSections(filtered, getValue, sort.dir)
  return latch
    ? [...groupBySection(sorted).values()].flatMap((group) => inFrozenOrder(group, latch.rank))
    : sorted
}
