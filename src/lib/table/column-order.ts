import { groupInOrder, regroupByKeys } from '@/lib/utils/group-in-order'

export type ColumnRanksT = Record<string, number>

// Sparse by design: a key with no entry ranks at its position in the assembled list, so a column
// added later lands where the code declares it instead of at the end.
function effectiveRank(key: string, assembleIndex: number, ranks: ColumnRanksT): number {
  return ranks[key] ?? assembleIndex
}

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

// Returns the input untouched when nothing is dropped — the kosztorys store runs this on every
// render and relies on the identity.
export function dropNonFiniteRanks(stored: ColumnRanksT): ColumnRanksT {
  const entries = Object.entries(stored)
  const finite = entries.filter(([, rank]) => Number.isFinite(rank))
  return finite.length === entries.length ? stored : Object.fromEntries(finite)
}

// Ties would fall through to the assemble index, which no scalar rank can then override.
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
  return rankOf(key)
}

export function baseRanksFromKeys(keys: readonly string[]): ColumnRanksT {
  return Object.fromEntries(keys.map((key, index) => [key, index]))
}

// The grid's base ranks and its ordering must count groups the same way or a drop's midpoint lands
// against the wrong neighbours, so both read this one grouping.
export function groupColumns<T extends { id?: string }>(
  columns: readonly T[],
  toKey: (id: string) => string,
): Map<string, T[]> {
  return groupInOrder(columns, (column) => toKey(column.id ?? ''))
}

export function orderColumns<T extends { id?: string }>(
  columns: readonly T[],
  ranks: ColumnRanksT,
  toKey: (id: string) => string,
): T[] {
  const groups = groupColumns(columns, toKey)
  return regroupByKeys(groups, orderColumnKeys([...groups.keys()], ranks))
}
