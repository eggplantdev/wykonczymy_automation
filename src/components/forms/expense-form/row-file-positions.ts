// Out-of-form invoice files are keyed by each row's stable client id (EX-448), but the submit
// contract (resolveUploadIdRows / createBulkTransferAction) is positional AND nested: row i is
// `lineItems[i]`, and its invoice pages are `mediaIds[i][0..n]` in attachment order (EX-659). These
// two pure projections bridge id-space ↔ position-space at that seam and nowhere else, so the whole
// in-form apparatus stays id-keyed while the wire stays positional.

/** id-space → position-space: project the id-keyed page lists onto row positions for submit. */
export function positionalFiles(
  lineItems: { id: string }[],
  byId: Map<string, File[]>,
): Map<number, File[]> {
  const positional = new Map<number, File[]>()
  lineItems.forEach((item, index) => {
    const files = byId.get(item.id)
    if (files?.length) positional.set(index, files)
  })
  return positional
}

/**
 * position-space → id-space: re-key positionally-persisted page lists (a recovered optimistic
 * submission, still in wire order) onto the recovered rows' ids so the restored form is id-keyed.
 */
export function filesByRowId(
  lineItems: { id: string }[],
  positional: Map<number, File[]>,
): Map<string, File[]> {
  const byId = new Map<string, File[]>()
  lineItems.forEach((item, index) => {
    const files = positional.get(index)
    if (files?.length) byId.set(item.id, files)
  })
  return byId
}
