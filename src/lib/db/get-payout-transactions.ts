import { sql } from '@payloadcms/db-postgres'
import type { Payload } from 'payload'
import { perfStart } from '@/lib/perf'
import { getDb } from '@/lib/db/get-db'
import { textOrNull } from '@/lib/db/row-coerce'
import type { PayoutTransactionRowT } from '@/types/transfers'

/**
 * Null worker kept deliberately — a payout with nobody attached is a real cash
 * movement that must still count toward Σ zaliczek, else „Pozostało do wypłaty" overstates the debt.
 */
export const getPayoutTransactionsForInvestment = async (
  payload: Payload,
  investmentId: number,
): Promise<PayoutTransactionRowT[]> => {
  const elapsed = perfStart()
  const db = await getDb(payload)

  const result = await db.execute(sql`
    SELECT type::text AS type, worker_id, date, amount, description
    FROM transactions
    WHERE type IN ('PAYOUT', 'BONUS')
      AND investment_id = ${investmentId}
      AND cancelled IS NOT TRUE
    ORDER BY date DESC, id DESC
  `)

  const rows = result.rows.map((row) => ({
    type: row.type === 'BONUS' ? ('BONUS' as const) : ('PAYOUT' as const),
    workerId: row.worker_id == null ? null : Number(row.worker_id),
    // The driver returns timestamptz as a year-first string ("2026-07-18 09:00:00+00"), which is
    // lexically == chronologically sortable — the client DataTable re-sorts „Wg daty" on it directly.
    date: String(row.date),
    amount: Number(row.amount),
    description: textOrNull(row.description),
  }))
  console.log(
    `[PERF] query.getPayoutTransactionsForInvestment ${elapsed()}ms (${rows.length} rows)`,
  )
  return rows
}
