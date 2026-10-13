import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

// A merged row sits where its earliest paragon did.
export function readRowOf(parts: DraftReceiptT[]): number | undefined {
  const readRows = parts.flatMap((part) => part.readRow ?? [])
  return readRows.length > 0 ? Math.min(...readRows) : undefined
}
