import type { DbExecutorT } from '@/lib/db/get-db'
import {
  appendDraftsInto,
  decisionRows,
  deleteExpenseDrafts,
  deleteReopenableSkippedReceipt,
  findDecidedReadRows,
  insertParagonDecisions,
  lockMergeCandidates,
  lockPendingExpenseDraft,
  settleExpenseDraft,
  skipUndecidedParagons,
  type DecisionRowsT,
  type RejectedReceiptT,
} from '@/lib/db/worker-expense-drafts'
import type { DuplicateOfT } from '@/lib/expense-duplicates/duplicate-of'
import type { ParagonRefusalT } from '@/lib/worker-expenses/paragon-refusal'

/**
 * Refused once the zgłoszenie is decided or any of these paragony already is, so two managers can't
 * both book one.
 */
export async function decideExpenseParagons(
  db: DbExecutorT,
  decision: DecisionRowsT & { draftId: number; decidedBy: number },
): Promise<{ rejected: RejectedReceiptT[] } | ParagonRefusalT> {
  const rows = decisionRows(decision)
  const requested = [
    ...rows.transfers.flatMap((t) => t.read_rows),
    ...rows.skipped.flatMap((r) => (r.read_row === null ? [] : [r.read_row])),
  ]
  if (!(await lockPendingExpenseDraft(db, decision.draftId))) return { refusal: 'not-pending' }
  const clash = await findDecidedReadRows(db, decision.draftId, requested)
  if (clash.length > 0) return { refusal: 'clash', readRows: clash }

  const rejected = await insertParagonDecisions(db, decision.draftId, rows)
  await settleExpenseDraft(db, decision.draftId, decision.decidedBy)
  return { rejected }
}

export async function rejectPendingParagons(
  db: DbExecutorT,
  decision: { draftId: number; decidedBy: number; duplicateOf?: DuplicateOfT },
): Promise<'refused' | 'no-read' | 'done'> {
  const readCount = await skipUndecidedParagons(db, decision)
  if (readCount === null) return 'refused'
  if (readCount === 0) return 'no-read'
  await settleExpenseDraft(db, decision.draftId, decision.decidedBy)
  return 'done'
}

export async function reopenSkippedReceipt(db: DbExecutorT, receiptId: number): Promise<boolean> {
  const draftId = await deleteReopenableSkippedReceipt(db, receiptId)
  if (draftId === null) return false
  await settleExpenseDraft(db, draftId, null)
  return true
}

export type MergeRefusalT = 'not-pending' | 'mixed' | 'decided' | 'unread'

/**
 * Refused once anything inside is decided — a decision names its read row by position, which the
 * chaining shifts — or while one has no read, whose photos would be paragony nothing tracks.
 */
export async function mergeExpenseDrafts(
  db: DbExecutorT,
  draftIds: number[],
): Promise<{ draftId: number } | { refusal: MergeRefusalT }> {
  const drafts = await lockMergeCandidates(db, draftIds)
  if (drafts.length !== draftIds.length || drafts.some((d) => d.status !== 'pending')) {
    return { refusal: 'not-pending' }
  }
  const [target, ...merged] = drafts
  const sameParties = drafts.every(
    (d) =>
      d.workerId === target.workerId &&
      d.investmentId === target.investmentId &&
      d.cashRegisterId === target.cashRegisterId,
  )
  if (!sameParties) return { refusal: 'mixed' }
  if (drafts.some((d) => d.hasDecisions)) return { refusal: 'decided' }
  if (drafts.some((d) => !d.hasRead)) return { refusal: 'unread' }

  const mergedIds = merged.map((d) => d.id)
  const note = drafts.flatMap((d) => (d.note ? [d.note] : [])).join('\n') || null
  await appendDraftsInto(db, target.id, mergedIds, note)
  await deleteExpenseDrafts(db, mergedIds)
  return { draftId: target.id }
}
