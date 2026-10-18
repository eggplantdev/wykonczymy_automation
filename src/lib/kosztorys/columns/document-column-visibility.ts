import { unpinned } from '@/lib/kosztorys/columns/document-column-order'

export type HiddenColumnMapT = Record<string, boolean>

export function resolveHiddenColumns(
  stored: unknown,
  ceiling: ReadonlySet<string>,
  defaultHidden: ReadonlySet<string>,
): string[] {
  const choices = (typeof stored === 'object' && stored !== null ? stored : {}) as Record<
    string,
    unknown
  >
  return unpinned([...ceiling]).filter((key) => {
    const choice = choices[key]
    return typeof choice === 'boolean' ? choice : defaultHidden.has(key)
  })
}

// Every offered column is written, shown ones included: an absent key means „the code default", so
// leaving out a column the owner chose to show would hide it again if its default is hidden.
export function toHiddenColumnMap(
  hidden: readonly string[],
  ceiling: ReadonlySet<string>,
): HiddenColumnMapT {
  const hiddenSet = new Set(hidden)
  return Object.fromEntries(unpinned([...ceiling]).map((key) => [key, hiddenSet.has(key)]))
}
