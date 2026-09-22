import { groupInOrder, regroupByKeys } from '@/lib/utils/group-in-order'

export type ColumnRanksT = Record<string, number>

// Sparse by design (same argument as useHiddenColumns): a key with no entry ranks at its position in
// the assembled list, so a column added later lands where the code declares it instead of at the end.
// A dense persisted `string[]` cannot do that — TanStack appends ids missing from it to the tail
// (`ColumnOrdering.ts`), so storing one freezes today's column set for anyone who ever dragged.
function effectiveRank(key: string, assembleIndex: number, ranks: ColumnRanksT): number {
  return ranks[key] ?? assembleIndex
}

// `keys` is the group-key list in assemble (sheet) order. Ties break by assemble index, so the
// result is a total order and an empty rank map is a no-op.
export function orderColumnKeys(keys: readonly string[], ranks: ColumnRanksT): string[] {
  return keys
    .map((key, index) => ({ key, index }))
    .sort(
      (a, b) =>
        effectiveRank(a.key, a.index, ranks) - effectiveRank(b.key, b.index, ranks) ||
        a.index - b.index,
    )
    .map(({ key }) => key)
}

// Ranks are arithmetic (midpoints, comparisons) and every store that holds them is client-writable,
// so a hand-edited `{"amount":"x"}` would put NaN in the comparator and scramble the order with no
// error. Returns the input untouched when nothing is dropped — the kosztorys store runs this on
// every render and relies on the identity.
export function dropNonFiniteRanks(stored: ColumnRanksT): ColumnRanksT {
  const entries = Object.entries(stored)
  const finite = entries.filter(([, rank]) => Number.isFinite(rank))
  return finite.length === entries.length ? stored : Object.fromEntries(finite)
}

// The single rank to persist so that `key` lands at `toIndex`.
//
// Interior drops take the midpoint of their new neighbours; the two edges take min−1 / max+1 over the
// whole list rather than neighbour∓1. Both choices keep effective ranks distinct WITHIN THE VIEW the
// drop happened in: a midpoint of a gap that holds no other rank can't collide, and a global extreme
// can't either. Ties would fall through to the assemble index, which no scalar rank can then override.
//
// Only within that view, though — the rank map is global while the assemble index is per-view (the
// rabat columns assemble only under a global discount, the stage axis only where etapy are shown), so
// a rank set in one view can tie an unranked key in another. That resolves deterministically by
// assemble index; it is a weaker guarantee, not a broken one. Same reason a midpoint can straddle a
// group the picker filters out: invisible where it was computed, ordered once it comes back.
export function rankForMove(
  orderedKeys: readonly string[],
  key: string,
  toIndex: number,
  ranks: ColumnRanksT,
  baseRanks: ColumnRanksT,
): number {
  const rankOf = (candidate: string) => ranks[candidate] ?? baseRanks[candidate] ?? 0
  const without = orderedKeys.filter((candidate) => candidate !== key)
  const previous = without[toIndex - 1]
  const next = without[toIndex]
  if (previous !== undefined && next !== undefined) return (rankOf(previous) + rankOf(next)) / 2
  if (next !== undefined) return Math.min(...without.map(rankOf)) - 1
  if (previous !== undefined) return Math.max(...without.map(rankOf)) + 1
  // Nothing to move against — a one-element list is already in order.
  return rankOf(key)
}

// Assemble index per group key — the fallback rank an unmoved key sorts at, which the reorder dialog
// can't derive on its own (it only ever sees the ALREADY ordered list).
export function baseRanksFromKeys(keys: readonly string[]): ColumnRanksT {
  return Object.fromEntries(keys.map((key, index) => [key, index]))
}

// Columns collapsed into their `toKey` groups, in first-seen order. The grid's base ranks and its
// ordering must count groups the same way or a drop's midpoint lands against the wrong neighbours,
// so both read this one grouping.
export function groupColumns<T extends { id?: string }>(
  columns: readonly T[],
  toKey: (id: string) => string,
): Map<string, T[]> {
  return groupInOrder(columns, (column) => toKey(column.id ?? ''))
}

// The same ordering over a full column list. Columns collapse into their `toKey` group first (stage
// columns share one key and must travel as a block), so a group keeps its internal order and moves
// as one.
export function orderColumns<T extends { id?: string }>(
  columns: readonly T[],
  ranks: ColumnRanksT,
  toKey: (id: string) => string,
): T[] {
  const groups = groupColumns(columns, toKey)
  return regroupByKeys(groups, orderColumnKeys([...groups.keys()], ranks))
}
