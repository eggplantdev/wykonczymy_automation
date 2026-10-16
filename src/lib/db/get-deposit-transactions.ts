import { sql } from '@payloadcms/db-postgres'
import type { Payload, Where } from 'payload'
import { perfStart } from '@/lib/perf'
import { buildSqlConditions, isNoResultsSentinel } from '@/lib/db/where-to-sql'
import { getDb } from '@/lib/db/get-db'
import type { VatPlaneT } from '@/lib/constants/transfers'
import type { DepositTransactionRowT } from '@/types/transfers'

/**
 * INVESTOR_DEPOSIT only, NOT the full DEPOSIT_TYPES: COMPANY_FUNDING („zasilenie z konta firmowego")
 * is the company financing its own investment, not a client payment, so it must never land in the
 * client wpłaty surface.
 */
export const getDepositTransactions = async (
  payload: Payload,
  where: Where,
): Promise<DepositTransactionRowT[]> => {
  if (isNoResultsSentinel(where)) return []

  const elapsed = perfStart()
  const db = await getDb(payload)
  const conditions = buildSqlConditions(where)

  const result = await db.execute(
    sql.raw(`
    SELECT id, date, amount, net_amount, vat_plane
    FROM transactions
    WHERE cancelled IS NOT TRUE
      AND type = 'INVESTOR_DEPOSIT'
      ${conditions}
    ORDER BY date DESC, id DESC
  `),
  )

  const rows = result.rows.map((row) => ({
    id: Number(row.id),
    // timestamptz arrives year-first ("2026-07-18 09:00:00+00") — lexically == chronologically
    // sortable, so the client DataTable re-sorts „Wg daty" on it directly.
    date: String(row.date),
    amount: Number(row.amount),
    netAmount: row.net_amount == null ? null : Number(row.net_amount),
    vatPlane: row.vat_plane == null ? null : (row.vat_plane as VatPlaneT),
  }))
  console.log(`[PERF] query.getDepositTransactions ${elapsed()}ms (${rows.length} rows)`)
  return rows
}

export const getDepositTransactionsForInvestment = async (
  payload: Payload,
  investmentId: number,
): Promise<DepositTransactionRowT[]> =>
  getDepositTransactions(payload, { investment: { equals: investmentId } })
