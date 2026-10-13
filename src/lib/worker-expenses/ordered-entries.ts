export type EntryT<T> = { item: T; index: number }

// While deciding, rows keep the order of the worker's photos, decided or not. A row with no read
// goes last, and ties keep the form's order.
export function orderedEntries<T extends { id: string }>(
  items: T[],
  readRowOf?: (id: string) => number | undefined,
): EntryT<T>[] {
  const entries = items.map((item, index) => ({ item, index }))
  if (!readRowOf) return entries
  const order = (entry: EntryT<T>) => readRowOf(entry.item.id) ?? Infinity
  return entries.sort((a, b) => order(a) - order(b) || a.index - b.index)
}
