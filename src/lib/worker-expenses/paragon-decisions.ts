import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import { isReceiptOf, type DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

export type ParagonDecisionT = 'accepted' | 'rejected'

export type ParagonOutcomesT = {
  acceptedReadRows?: number[]
  rejectedReceipts?: RejectedReceiptT[]
}

// A row is decided only when every paragon in it is: a merged row half-booked elsewhere stays
// waiting, and its split brings the still-open paragon back alone.
export function paragonDecisions(
  receipts: Map<string, DraftReceiptT[]>,
  { acceptedReadRows = [], rejectedReceipts = [] }: ParagonOutcomesT,
): Map<string, ParagonDecisionT> {
  const accepted = new Set(acceptedReadRows)
  const isAccepted = (part: DraftReceiptT) =>
    part.readRow !== undefined && accepted.has(part.readRow)
  const isRejected = (part: DraftReceiptT) =>
    rejectedReceipts.some((receipt) => isReceiptOf(receipt, part))

  const decisions = new Map<string, ParagonDecisionT>()
  for (const [id, parts] of receipts) {
    if (parts.length === 0) continue
    if (parts.every(isAccepted)) decisions.set(id, 'accepted')
    else if (parts.every(isRejected)) decisions.set(id, 'rejected')
  }
  return decisions
}
