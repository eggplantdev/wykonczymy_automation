export type EntryT<T> = { item: T; index: number }

export function orderedEntries<T extends { id: string }>(
  items: T[],
  readRowOf?: (id: string) => number | undefined,
): EntryT<T>[] {
  const entries = items.map((item, index) => ({ item, index }))
  if (!readRowOf) return entries
  const order = (entry: EntryT<T>) => readRowOf(entry.item.id) ?? Infinity
  return entries.sort((a, b) => order(a) - order(b) || a.index - b.index)
}
