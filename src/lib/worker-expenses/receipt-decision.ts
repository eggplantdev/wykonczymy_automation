import type { DuplicateOfT, SkippedReceiptT } from '@/lib/expense-duplicates/duplicate-of'

// One paragon of a zgłoszenie: its pages, and which row of the draft's AI read it was filled from.
// The pages alone don't name it — one photo can hold several paragony.
export type DraftReceiptT = Omit<SkippedReceiptT, 'duplicateOf'>

// Positional to `lineItems`: the worker's pages each transakcja is booked from. A paragon the
// manager removed from the acceptance is skipped, not lost — it stays in the worker's history.
export function receiptDecision(
  receipts: Map<string, DraftReceiptT>,
  lineItems: { id: string }[],
  duplicateOfByItemId: Map<string, DuplicateOfT> = new Map(),
): { receiptMediaIds: number[][]; skippedReceipts: SkippedReceiptT[] } {
  const keptIds = new Set(lineItems.map((item) => item.id))
  return {
    receiptMediaIds: lineItems.map((item) => receipts.get(item.id)?.mediaIds ?? []),
    skippedReceipts: [...receipts]
      .filter(([id]) => !keptIds.has(id))
      .map(([id, receipt]) => {
        const duplicateOf = duplicateOfByItemId.get(id)
        return duplicateOf ? { ...receipt, duplicateOf } : receipt
      }),
  }
}
