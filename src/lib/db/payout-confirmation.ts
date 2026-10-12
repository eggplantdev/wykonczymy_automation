import { sql } from '@payloadcms/db-vercel-postgres'
import {
  CANCELLED_PAYOUT_VISIBLE_DAYS,
  type PayoutStatusT,
} from '@/lib/constants/payout-confirmation'
import type { DbExecutorT } from './get-db'
import { lockMessageOf } from './investment-gate'
import { isoOrNull, text, textOrNull } from './row-coerce'

export type PayoutToConfirmT = {
  id: number
  date: string
  amount: number
  description: string
  investmentName: string | null
  status: PayoutStatusT
  rejectionReason: string | null
  cancelled: boolean
}

export type RejectedPayoutT = {
  id: number
  date: string
  amount: number
  description: string
  workerName: string
  investmentName: string | null
  investmentLockMessage: string | undefined
  sourceRegisterName: string | null
  rejectionReason: string
  decidedAt: string
}

// Ownership and state ride in the WHERE, so a foreign, cancelled or already-decided wypłata matches
// zero rows — the race between two tabs, or the worker and a cancellation, is settled by Postgres.
const DECIDABLE = (transactionId: number, workerId: number) => sql`
  id = ${transactionId} AND worker_id = ${workerId} AND type = 'PAYOUT' AND cancelled IS NOT TRUE
`

// A rejected wypłata stays acceptable — he may have found the missing cash — and keeps its reason.
export async function acceptPayout(
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

export async function rejectPayout(
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

// A cancelled one stays listed for a while, or a wypłata he was waiting to answer just vanishes.
export async function listPayoutsToConfirm(
  db: DbExecutorT,
  workerId: number,
): Promise<PayoutToConfirmT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.description, i.name AS investment_name,
           t.payout_status, t.payout_rejection_reason, t.cancelled IS TRUE AS cancelled
    FROM transactions t
    LEFT JOIN investments i ON i.id = t.investment_id
    WHERE t.worker_id = ${workerId} AND t.type = 'PAYOUT'
      AND t.payout_status IN ('pending', 'rejected')
      AND (
        t.cancelled IS NOT TRUE
        OR EXISTS (
          SELECT 1 FROM transactions c
          WHERE c.cancelled_transaction_id = t.id AND c.type = 'CANCELLATION'
            AND c.created_at > now() - make_interval(days => ${CANCELLED_PAYOUT_VISIBLE_DAYS})
        )
      )
    ORDER BY t.cancelled IS TRUE, t.payout_status <> 'pending', t.date DESC, t.id DESC
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    date: isoOrNull(row.date) ?? '',
    amount: Number(row.amount),
    description: text(row.description),
    investmentName: textOrNull(row.investment_name),
    status: row.payout_status as PayoutStatusT,
    rejectionReason: textOrNull(row.payout_rejection_reason),
    cancelled: Boolean(row.cancelled),
  }))
}

// What the app icon's badge shows: the wypłaty still waiting on his answer. A rejected one waits on
// management, not on him.
export async function countPendingPayouts(db: DbExecutorT, workerId: number): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM transactions
    WHERE worker_id = ${workerId} AND type = 'PAYOUT' AND cancelled IS NOT TRUE
      AND payout_status = 'pending'
  `)
  return Number(res.rows[0]?.total ?? 0)
}

const AWAITING_MANAGEMENT = sql`t.payout_status = 'rejected' AND t.cancelled IS NOT TRUE`

export async function countRejectedPayouts(db: DbExecutorT): Promise<number> {
  const res = await db.execute(sql`
    SELECT count(*)::int AS total FROM transactions t WHERE ${AWAITING_MANAGEMENT}
  `)
  return Number(res.rows[0]?.total ?? 0)
}

export async function listRejectedPayouts(db: DbExecutorT): Promise<RejectedPayoutT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.description, w.name AS worker_name,
           i.name AS investment_name, i.status, i.trashed_at, r.name AS source_register_name,
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
    workerName: text(row.worker_name),
    investmentName: textOrNull(row.investment_name),
    investmentLockMessage: lockMessageOf(row),
    sourceRegisterName: textOrNull(row.source_register_name),
    rejectionReason: text(row.payout_rejection_reason),
    decidedAt: isoOrNull(row.payout_decided_at) ?? '',
  }))
}
