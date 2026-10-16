import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DepositPlaneSumsT } from '@/lib/kosztorys/deposit-planes'
import type { DbExecutorT } from './get-db'

export type DepositPlaneSumsRowT = DepositPlaneSumsT & { investmentId: number }

/**
 * Untagged counts as netto; `IS DISTINCT FROM` is what carries the null.
 *
 * COMPANY_FUNDING is the company financing its own investment and must never pay down what
 * the client owes.
 */
export async function selectDepositPlaneSums(db: DbExecutorT): Promise<DepositPlaneSumsRowT[]> {
  const res = await db.execute(sql`
    SELECT investment_id,
      COALESCE(SUM(amount) FILTER (WHERE vat_plane IS DISTINCT FROM 'GROSS'), 0) AS paid_net,
      COALESCE(SUM(net_amount) FILTER (WHERE vat_plane = 'GROSS'), 0) AS paid_gross_net,
      COALESCE(SUM(amount) FILTER (WHERE vat_plane = 'GROSS'), 0) AS paid_gross,
      COUNT(*) FILTER (WHERE vat_plane IS DISTINCT FROM 'GROSS') AS paid_net_count
    FROM transactions
    WHERE investment_id IS NOT NULL
      AND type = 'INVESTOR_DEPOSIT'
      AND cancelled IS NOT TRUE
    GROUP BY investment_id
  `)
  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    paidNet: Number(row.paid_net),
    paidGrossNet: Number(row.paid_gross_net),
    paidGross: Number(row.paid_gross),
    paidNetCount: Number(row.paid_net_count),
  }))
}
