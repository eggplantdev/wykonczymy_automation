import type { KosztorysV2RowT } from '@/lib/kosztorys/types'

// Parity with v1.
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

// Sort by the accessor's value; strings by locale (pl), numbers numerically. Returns a new array.
// Decorate-sort-undecorate: getValue can be an O(stages) reduce (the "remaining" key), and calling
// it inside the comparator would re-evaluate it ~2·n·log(n) times — compute it once per row instead.
//
// A null key renders as "—" (fmtOrDash), so it has no place in the order: sorted numerically it
// would land as 0 and the dash would masquerade as a settled row. Nulls sink to the bottom under
// BOTH directions — `sign` deliberately does not touch that branch, or "desc" would float them up.
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
