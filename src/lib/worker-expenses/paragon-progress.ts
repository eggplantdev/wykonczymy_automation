import type { DraftProgressT } from '@/lib/db/worker-expense-drafts'
import type { ParagonDecisionT } from '@/lib/worker-expenses/paragon-decisions'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

// Counted in read rows, like the list's badge: a merged booking still covers each paragon it took.
export function paragonProgress(
  receipts: Map<string, DraftReceiptT[]>,
  rowIds: string[],
  decisions: Map<string, ParagonDecisionT>,
): DraftProgressT {
  const progress = { accepted: 0, rejected: 0, pending: 0 }
  for (const id of rowIds) {
    const readRows = (receipts.get(id) ?? []).filter((part) => part.readRow !== undefined).length
    progress[decisions.get(id) ?? 'pending'] += readRows
  }
  return progress
}
