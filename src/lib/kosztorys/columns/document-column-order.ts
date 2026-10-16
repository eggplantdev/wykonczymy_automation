import { baseRanksFromKeys, orderColumnKeys, type ColumnRanksT } from '@/lib/table/column-order'

// Always first and never hidden: the PDF's section total writes its „Razem — <sekcja>" label into
// the cells left of the money column, which is only guaranteed to exist while this column leads.
export const DOCUMENT_PINNED_COLUMN = 'description'

export function unpinned(keys: readonly string[]): string[] {
  return keys.filter((key) => key !== DOCUMENT_PINNED_COLUMN)
}

export function orderDocumentKeys(keys: readonly string[], ranks: ColumnRanksT): string[] {
  const rest = orderColumnKeys(unpinned(keys), ranks)
  return keys.includes(DOCUMENT_PINNED_COLUMN) ? [DOCUMENT_PINNED_COLUMN, ...rest] : rest
}

// NaN in the comparator scrambles the order with no error.
export function sanitizeDocumentRanks(source: unknown, ceiling: ReadonlySet<string>): ColumnRanksT {
  if (typeof source !== 'object' || source === null) return {}
  return Object.fromEntries(
    Object.entries(source).filter(
      (entry): entry is [string, number] =>
        ceiling.has(entry[0]) &&
        entry[0] !== DOCUMENT_PINNED_COLUMN &&
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]),
    ),
  )
}

// Built over the SAME list `orderDocumentKeys` sorts: an unranked key sorts at its index in that
// list, so base ranks counted with the pinned key included would land every drag one slot off.
export function documentBaseRanks(keys: readonly string[]): ColumnRanksT {
  return baseRanksFromKeys(unpinned(keys))
}
