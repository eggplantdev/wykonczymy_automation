import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DepositPlaneSumsT } from '@/lib/kosztorys/deposit-planes'
import type { DbExecutorT } from './get-db'

export type DepositPlaneSumsRowT = DepositPlaneSumsT & { investmentId: number }

/**
 * The wpłaty of EVERY investment, bucketed by VAT plane — the listing's twin of the panel's
 * `bucketDepositsByPlane`, summed in SQL because the listing has no business shipping every wpłata
 * row to compute a handful of scalars. Untagged counts as netto, the same „brak wartości = netto" rule
 * (owner, 2026-07-23) the TS bucketing applies; `IS DISTINCT FROM` is what carries the null.
 *
 * Raw sums only: nothing is crossed here. A wpłata brutto carries its own netto (`net_amount`), and
 * `SUM` skipping a NULL is what makes a row without one worth 0 zł netto — the same answer the TS
 * bucketing gives. Folding the buckets into a pair stays in ONE place, `depositPairFromPlaneSums`.
 *
 * `INVESTOR_DEPOSIT` only, matching `getDepositTransactions` rather than the `income` financial
 * bucket: COMPANY_FUNDING is the company financing its own investment and must never pay down what
 * the client owes. That is a deliberate narrowing of the v1 bilans, whose `totalIncome` still counts
 * all three deposit types — v2 settles the client, v1 reads the cash ledger.
 *
 * The netto bucket is counted as well as summed: in tryb brutto those wpłaty pay nothing down, and
 * the listing has to say how many were dropped (EX-724) with no row in reach to count.
 *
 * An investment with no wpłaty is simply absent, which the caller reads as zero on both planes.
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
