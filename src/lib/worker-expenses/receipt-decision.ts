import type { DuplicateOfT, SkippedReceiptT } from '@/lib/expense-duplicates/duplicate-of'

// Positional to `lineItems`: the worker's pages each transakcja is booked from. A paragon the
// manager removed from the acceptance is skipped, not lost — it stays in the worker's history.
export function receiptDecision(
  receiptMediaIds: Map<string, number[]>,
  lineItems: { id: string }[],
  duplicateOfByItemId: Map<string, DuplicateOfT> = new Map(),
): { receiptMediaIds: number[][]; skippedReceipts: SkippedReceiptT[] } {
  const keptIds = new Set(lineItems.map((item) => item.id))
  return {
    receiptMediaIds: lineItems.map((item) => receiptMediaIds.get(item.id) ?? []),
    skippedReceipts: [...receiptMediaIds]
      .filter(([id]) => !keptIds.has(id))
      .map(([id, mediaIds]) => {
        const duplicateOf = duplicateOfByItemId.get(id)
        return duplicateOf ? { mediaIds, duplicateOf } : { mediaIds }
      }),
  }
}
