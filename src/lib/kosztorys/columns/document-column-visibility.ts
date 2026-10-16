import { unpinned } from '@/lib/kosztorys/columns/document-column-order'

export type HiddenColumnMapT = Record<string, boolean>

/**
 * A legacy hidden array speaks only for the columns it was written against
 * (`legacyCeiling`), so a row `20261015_0` has not converted yet cannot show a later column either.
 */
export function resolveHiddenColumns(
  stored: unknown,
  ceiling: ReadonlySet<string>,
  defaultHidden: ReadonlySet<string>,
  legacyCeiling: ReadonlySet<string>,
): string[] {
  if (Array.isArray(stored)) {
    const legacyHidden = new Set(stored)
    return unpinned([...ceiling]).filter((key) =>
      legacyCeiling.has(key) ? legacyHidden.has(key) : defaultHidden.has(key),
    )
  }
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
