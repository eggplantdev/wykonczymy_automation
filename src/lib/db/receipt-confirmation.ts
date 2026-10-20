import { sql } from '@payloadcms/db-postgres'
import type { PayoutStatusT } from '@/lib/constants/payout-status'
import type { DbExecutorT } from './get-db'
import { lockMessageOf } from './investment-gate'
import { isoOrNull, numOrNull, text, textOrNull } from './row-coerce'

export type ReceiptToConfirmT = {
  id: number
  date: string
  amount: number
  description: string
  investmentName: string | null
  status: PayoutStatusT
  rejectionReason: string | null
}

export type RejectedReceiptT = {
  id: number
  date: string
  amount: number
  description: string
  workerId: number
  workerName: string
  investmentId: number | null
  investmentName: string | null
  investmentLockMessage: string | undefined
  sourceRegisterId: number | null
  sourceRegisterName: string | null
  sourceRegisterTrashed: boolean
  rejectionReason: string
  decidedAt: string
}

// Ownership and state ride in the WHERE, so a foreign, cancelled or already-decided wypłata matches
// zero rows — the race between two tabs, or the worker and a cancellation, is settled by Postgres.
const DECIDABLE = (transactionId: number, workerId: number) => sql`
  id = ${transactionId} AND worker_id = ${workerId} AND type = 'PAYOUT' AND cancelled IS NOT TRUE
`

// A rejected wypłata stays acceptable — he may have found the missing cash — and keeps its reason.
export async function acceptReceipt(
  db: DbExecutorT,
  decision: { transactionId: number; workerId: number },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE transactions SET payout_status = 'accepted', payout_decided_at = now()
    WHERE ${DECIDABLE(decision.transactionId, decision.workerId)}
      AND payout_status IN ('pending', 'rejected')
    RETURNING id
  `)
  return res.rows.length > 0
}

export async function rejectReceipt(
  db: DbExecutorT,
  decision: { transactionId: number; workerId: number; reason: string },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE transactions
    SET payout_status = 'rejected', payout_decided_at = now(),
        payout_rejection_reason = ${decision.reason}
    WHERE ${DECIDABLE(decision.transactionId, decision.workerId)} AND payout_status = 'pending'
    RETURNING id
  `)
  return res.rows.length > 0
}

export async function listReceiptsToConfirm(
  db: DbExecutorT,
  workerId: number,
): Promise<ReceiptToConfirmT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.description, i.name AS investment_name,
           t.payout_status, t.payout_rejection_reason
    FROM transactions t
    LEFT JOIN investments i ON i.id = t.investment_id
    WHERE t.worker_id = ${workerId} AND t.type = 'PAYOUT' AND t.cancelled IS NOT TRUE
      AND t.payout_status IN ('pending', 'rejected')
    ORDER BY t.payout_status <> 'pending', t.date DESC, t.id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    date: isoOrNull(row.date) ?? '',
    amount: Number(row.amount),
    description: text(row.description),
    investmentName: textOrNull(row.investment_name),
    status: row.payout_status as PayoutStatusT,
    rejectionReason: textOrNull(row.payout_rejection_reason),
  }))
}

export async function countPendingReceipts(db: DbExecutorT, workerId: number): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM transactions
    WHERE worker_id = ${workerId} AND type = 'PAYOUT' AND cancelled IS NOT TRUE
      AND payout_status = 'pending'
  `)
  return Number(res.rows[0]?.total ?? 0)
}

const AWAITING_MANAGEMENT = sql`t.payout_status = 'rejected' AND t.cancelled IS NOT TRUE`

export const REJECTED_RECEIPTS_COUNT = sql`
  SELECT count(*)::int AS total FROM transactions t WHERE ${AWAITING_MANAGEMENT}
`

export async function listRejectedReceipts(db: DbExecutorT): Promise<RejectedReceiptT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.description, t.worker_id, w.name AS worker_name,
           t.investment_id, i.name AS investment_name, i.status, i.trashed_at,
           t.source_register_id, r.name AS source_register_name,
           r.trashed_at AS source_register_trashed_at,
           t.payout_rejection_reason, t.payout_decided_at
    FROM transactions t
    LEFT JOIN users w ON w.id = t.worker_id
    LEFT JOIN investments i ON i.id = t.investment_id
    LEFT JOIN cash_registers r ON r.id = t.source_register_id
    WHERE ${AWAITING_MANAGEMENT}
    ORDER BY t.payout_decided_at, t.id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    date: isoOrNull(row.date) ?? '',
    amount: Number(row.amount),
    description: text(row.description),
    workerId: Number(row.worker_id),
    workerName: text(row.worker_name),
    investmentId: numOrNull(row.investment_id),
    investmentName: textOrNull(row.investment_name),
    investmentLockMessage: lockMessageOf(row),
    sourceRegisterId: numOrNull(row.source_register_id),
    sourceRegisterName: textOrNull(row.source_register_name),
    sourceRegisterTrashed: row.source_register_trashed_at != null,
    rejectionReason: text(row.payout_rejection_reason),
    decidedAt: isoOrNull(row.payout_decided_at) ?? '',
  }))
}
