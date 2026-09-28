import { DOCUMENT_PINNED_COLUMN } from '@/lib/kosztorys/column-config'
import { baseRanksFromKeys, orderColumnKeys, type ColumnRanksT } from '@/lib/table/column-order'

function unpinned(keys: readonly string[]): string[] {
  return keys.filter((key) => key !== DOCUMENT_PINNED_COLUMN)
}

// The owner's stored order over one document list. The pinned column is lifted out before sorting
// and put back in front, so no rank — stored by hand or by a drag — can move it.
export function orderDocumentKeys(keys: readonly string[], ranks: ColumnRanksT): string[] {
  const rest = orderColumnKeys(unpinned(keys), ranks)
  return keys.includes(DOCUMENT_PINNED_COLUMN) ? [DOCUMENT_PINNED_COLUMN, ...rest] : rest
}

// A stored order cannot disclose anything — the ceiling decides that — so a bad entry is simply
// dropped: a key outside the audience's ceiling, a rank on the pinned column, or a rank that is not
// a finite number (NaN in the comparator scrambles the order with no error).
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
