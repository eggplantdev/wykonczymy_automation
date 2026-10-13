import type { RejectedReceiptT } from '@/lib/db/worker-expense-drafts'
import type { DraftReceiptT } from '@/lib/worker-expenses/receipt-decision'

// A paragon's refusal names it by its read row, or by its photos when the read never covered it.
// A refusal naming no photos names nothing: `every` over an empty list would match every paragon.
export const isReceiptOf = (receipt: RejectedReceiptT, part: DraftReceiptT) =>
  receipt.readRow === null
    ? part.readRow === undefined &&
      receipt.mediaIds.length > 0 &&
      receipt.mediaIds.every((id) => part.mediaIds.includes(id))
    : receipt.readRow === part.readRow
