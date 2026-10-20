import { sql } from '@payloadcms/db-postgres'
import type { PayoutStatusT } from '@/lib/constants/payout-status'
import type { TransferTypeT } from '@/lib/constants/transfers'
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

export type BookedReceiptT = { recipientId: number; amount: number }

export type RejectedReceiptT = {
  id: number
  date: string
  amount: number
  description: string
  type: TransferTypeT
  recipientId: number
  recipientName: string
  investmentId: number | null
  investmentName: string | null
  investmentLockMessage: string | undefined
  registerId: number | null
  registerName: string | null
  registerTrashed: boolean
  rejectionReason: string
  decidedAt: string
}

// Moving money between two kasy of the same worker hands him nothing, so it asks him nothing.
export async function handsMoneyToEmployee(
  db: DbExecutorT,
  registers: { receivingRegisterId: number; sendingRegisterId?: number },
): Promise<boolean> {
  const sameOwner =
    registers.sendingRegisterId === undefined
      ? sql`FALSE`
      : sql`r.owner_id IS NOT DISTINCT FROM (SELECT owner_id FROM cash_registers WHERE id = ${registers.sendingRegisterId})`
  const res = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM cash_registers r JOIN users u ON u.id = r.owner_id
      WHERE r.id = ${registers.receivingRegisterId} AND u.role = 'EMPLOYEE' AND NOT (${sameOwner})
    ) AS hands
  `)
  return res.rows[0]?.hands === true
}

const RECEIVING_REGISTER = sql`
  CASE WHEN t.type = 'REGISTER_TRANSFER' THEN t.target_register_id ELSE t.source_register_id END
`

// Decide, list and count all read this one expression, so who may answer can never drift between them.
const RECIPIENT = sql`
  CASE WHEN t.type = 'PAYOUT' THEN t.worker_id
       ELSE (SELECT r.owner_id FROM cash_registers r WHERE r.id = ${RECEIVING_REGISTER})
  END
`

// Ownership and state ride in the WHERE, so a foreign, cancelled or already-decided row matches
// zero rows — the race between two tabs, or the worker and a cancellation, is settled by Postgres.
const DECIDABLE = (transactionId: number, workerId: number) => sql`
  t.id = ${transactionId} AND ${RECIPIENT} = ${workerId}
  AND t.payout_status IS NOT NULL AND t.cancelled IS NOT TRUE
`

// A rejected row stays acceptable — he may have found the missing cash — and keeps its reason.
export async function acceptReceipt(
  db: DbExecutorT,
  decision: { transactionId: number; workerId: number },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE transactions t SET payout_status = 'accepted', payout_decided_at = now()
    WHERE ${DECIDABLE(decision.transactionId, decision.workerId)}
      AND t.payout_status IN ('pending', 'rejected')
    RETURNING t.id
  `)
  return res.rows.length > 0
}

export async function rejectReceipt(
  db: DbExecutorT,
  decision: { transactionId: number; workerId: number; reason: string },
): Promise<boolean> {
  const res = await db.execute(sql`
    UPDATE transactions t
    SET payout_status = 'rejected', payout_decided_at = now(),
        payout_rejection_reason = ${decision.reason}
    WHERE ${DECIDABLE(decision.transactionId, decision.workerId)} AND t.payout_status = 'pending'
    RETURNING t.id
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
    WHERE t.payout_status IN ('pending', 'rejected') AND t.cancelled IS NOT TRUE
      AND ${RECIPIENT} = ${workerId}
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
    SELECT count(*)::int AS total FROM transactions t
    WHERE t.payout_status = 'pending' AND t.cancelled IS NOT TRUE AND ${RECIPIENT} = ${workerId}
  `)
  return Number(res.rows[0]?.total ?? 0)
}

export async function pendingReceiptsOf(
  db: DbExecutorT,
  transactionIds: number[],
): Promise<BookedReceiptT[]> {
  if (transactionIds.length === 0) return []
  const res = await db.execute(sql`
    SELECT ${RECIPIENT} AS recipient_id, t.amount FROM transactions t
    WHERE t.id IN (${sql.join(
      transactionIds.map((id) => sql`${id}`),
      sql.raw(', '),
    )})
      AND t.payout_status = 'pending' AND t.cancelled IS NOT TRUE
  `)
  return res.rows.flatMap((row) =>
    row.recipient_id == null
      ? []
      : [{ recipientId: Number(row.recipient_id), amount: Number(row.amount) }],
  )
}

const AWAITING_MANAGEMENT = sql`t.payout_status = 'rejected' AND t.cancelled IS NOT TRUE`

export const REJECTED_RECEIPTS_COUNT = sql`
  SELECT count(*)::int AS total FROM transactions t WHERE ${AWAITING_MANAGEMENT}
`

export async function listRejectedReceipts(db: DbExecutorT): Promise<RejectedReceiptT[]> {
  const res = await db.execute(sql`
    SELECT t.id, t.date, t.amount, t.description, t.type, w.id AS recipient_id,
           w.name AS recipient_name,
           t.investment_id, i.name AS investment_name, i.status, i.trashed_at,
           r.id AS register_id, r.name AS register_name, r.trashed_at AS register_trashed_at,
           t.payout_rejection_reason, t.payout_decided_at
    FROM transactions t
    LEFT JOIN users w ON w.id = ${RECIPIENT}
    LEFT JOIN investments i ON i.id = t.investment_id
    LEFT JOIN cash_registers r ON r.id = ${RECEIVING_REGISTER}
    WHERE ${AWAITING_MANAGEMENT}
    ORDER BY t.payout_decided_at, t.id
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    date: isoOrNull(row.date) ?? '',
    amount: Number(row.amount),
    description: text(row.description),
    type: row.type as TransferTypeT,
    recipientId: Number(row.recipient_id),
    recipientName: text(row.recipient_name),
    investmentId: numOrNull(row.investment_id),
    investmentName: textOrNull(row.investment_name),
    investmentLockMessage: lockMessageOf(row),
    registerId: numOrNull(row.register_id),
    registerName: textOrNull(row.register_name),
    registerTrashed: row.register_trashed_at != null,
    rejectionReason: text(row.payout_rejection_reason),
    decidedAt: isoOrNull(row.payout_decided_at) ?? '',
  }))
}
