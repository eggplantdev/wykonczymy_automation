import { DOCUMENT_PINNED_COLUMN } from '@/lib/kosztorys/columns/document-column-order'

export type HiddenColumnMapT = Record<string, boolean>

function unpinnedCeiling(ceiling: ReadonlySet<string>): string[] {
  return [...ceiling].filter((key) => key !== DOCUMENT_PINNED_COLUMN)
}

/**
 * Stored settings → the hidden keys. A document setting stores one choice per column it offered at
 * save time, and a column it does not mention reads as its CODE default — so a column added later
 * starts where the code declares it, with no migration, instead of showing because no stored list
 * names it (EX-1033). The legacy hidden array is still read as it always was, until every row is
 * converted. `null` means the value is neither shape, and the caller falls back to its defaults.
 */
export function resolveHiddenColumns(
  stored: unknown,
  ceiling: ReadonlySet<string>,
  defaultHidden: ReadonlySet<string>,
): string[] | null {
  if (Array.isArray(stored)) {
    const legacyHidden = new Set(stored)
    return unpinnedCeiling(ceiling).filter((key) => legacyHidden.has(key))
  }
  if (typeof stored !== 'object' || stored === null) return null
  const choices = stored as Record<string, unknown>
  return unpinnedCeiling(ceiling).filter((key) => {
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
  return Object.fromEntries(unpinnedCeiling(ceiling).map((key) => [key, hiddenSet.has(key)]))
}
