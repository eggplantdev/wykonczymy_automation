import type { DuplicateOfT, SkippedReceiptT } from '@/lib/expense-duplicates/duplicate-of'

// One paragon of a zgłoszenie: its pages, and which row of the draft's AI read it was filled from.
// The pages alone don't name it — one photo can hold several paragony.
export type DraftReceiptT = Omit<SkippedReceiptT, 'duplicateOf'>

// Positional to `lineItems`: the worker's pages each transakcja is booked from, and the paragony
// behind it — several once the manager merged rows. A row the manager removed is skipped paragon by
// paragon, not lost: each stays in the worker's history and comes back alone on „Przywróć".
export function receiptDecision(
  receipts: Map<string, DraftReceiptT[]>,
  lineItems: { id: string }[],
  duplicateOfByItemId: Map<string, DuplicateOfT> = new Map(),
): { receiptMediaIds: number[][]; receiptReadRows: number[][]; skippedReceipts: SkippedReceiptT[] } {
  const keptIds = new Set(lineItems.map((item) => item.id))
  const booked = lineItems.map((item) => bookedReceipt(receipts.get(item.id) ?? []))
  return {
    receiptMediaIds: booked.map((receipt) => receipt.mediaIds),
    receiptReadRows: booked.map((receipt) => receipt.readRows),
    skippedReceipts: [...receipts]
      .filter(([id]) => !keptIds.has(id))
      .flatMap(([id, parts]) => {
        const duplicateOf = duplicateOfByItemId.get(id)
        return parts.map((part) => (duplicateOf ? { ...part, duplicateOf } : part))
      }),
  }
}

export function mergeParts(
  receipts: Map<string, DraftReceiptT[]>,
  ids: string[],
  mergedId: string,
): Map<string, DraftReceiptT[]> {
  const next = new Map(receipts)
  const parts = ids.flatMap((id) => next.get(id) ?? [])
  ids.forEach((id) => next.delete(id))
  return next.set(mergedId, parts)
}

export function splitParts(
  receipts: Map<string, DraftReceiptT[]>,
  id: string,
  rows: [id: string, part: DraftReceiptT][],
): Map<string, DraftReceiptT[]> {
  const next = new Map(receipts)
  next.delete(id)
  rows.forEach(([rowId, part]) => next.set(rowId, [part]))
  return next
}

export function bookedReceipt(parts: DraftReceiptT[]): { mediaIds: number[]; readRows: number[] } {
  return {
    mediaIds: [...new Set(parts.flatMap((part) => part.mediaIds))],
    readRows: parts.flatMap((part) => (part.readRow === undefined ? [] : [part.readRow])),
  }
}
