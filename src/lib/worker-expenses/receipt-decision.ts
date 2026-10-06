// Positional to `lineItems`: the worker's pages each transakcja is booked from. A paragon the
// manager removed from the acceptance is skipped, not lost — it stays in the worker's history.
export function receiptDecision(
  receiptMediaIds: Map<string, number[]>,
  lineItems: { id: string }[],
): { receiptMediaIds: number[][]; skippedReceipts: number[][] } {
  const keptIds = new Set(lineItems.map((item) => item.id))
  return {
    receiptMediaIds: lineItems.map((item) => receiptMediaIds.get(item.id) ?? []),
    skippedReceipts: [...receiptMediaIds]
      .filter(([id]) => !keptIds.has(id))
      .map(([, mediaIds]) => mediaIds),
  }
}
