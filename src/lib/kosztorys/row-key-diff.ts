// The grid caches each row's height and vertical position by INDEX and never invalidates that cache
// on its own, so an insert or a delete leaves every row below reading the previous occupant's height.
export function firstChangedRowIndex(
  prev: readonly string[],
  next: readonly string[],
): number | null {
  const shared = Math.min(prev.length, next.length)
  for (let i = 0; i < shared; i++) {
    if (prev[i] !== next[i]) return i
  }
  return prev.length === next.length ? null : shared
}

export function firstChangedHeightIndex(
  prev: Readonly<Record<string, number>>,
  next: Readonly<Record<string, number>>,
  rowKeys: readonly string[],
): number | null {
  if (prev === next) return null
  let earliest: number | null = null
  for (const key of new Set([...Object.keys(prev), ...Object.keys(next)])) {
    if (prev[key] === next[key]) continue
    const index = rowKeys.indexOf(key)
    if (index === -1) continue
    if (earliest === null || index < earliest) earliest = index
  }
  return earliest
}
