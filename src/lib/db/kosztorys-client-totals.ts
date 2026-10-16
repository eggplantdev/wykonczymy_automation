import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { DbExecutorT } from './get-db'

// TS is the reference implementation; this is the copy, pinned against it by a DB-backed parity
// spec (__tests__/lib/db/kosztorys-client-totals.test.ts).

export type KosztorysClientTotalsRowT = KosztorysClientTotalsT & { investmentId: number }

const num = (v: unknown): number => Number(v ?? 0)

export async function selectKosztorysClientTotals(
  db: DbExecutorT,
): Promise<KosztorysClientTotalsRowT[]> {
  const res = await db.execute(sql`
    WITH item_qty AS (
      SELECT
        ki.investment_id,
        ki.client_price,
        ki.discount_type,
        ki.discount_value,
        coalesce(q.qty, 0) AS qty
      FROM kosztorys_items ki
      LEFT JOIN (
        SELECT sp.item_id, sum(sp.qty_done) AS qty
        FROM stage_progress sp
        GROUP BY sp.item_id
      ) q ON q.item_id = ki.id
    ),
    priced AS (
      SELECT
        iq.investment_id,
        iq.qty * iq.client_price AS gross,
        CASE
          -- Without this an 'amount' rabat turns an untouched row into −discountValue.
          WHEN NOT (iq.qty > 0) THEN 0
          -- applyDiscount short-circuits on the global discount BEFORE reading discountType: an
          -- active global rabat prices every row gross of its own, and is subtracted once at the
          -- total level below.
          WHEN inv.global_discount_type = 'amount' THEN iq.qty * iq.client_price
          WHEN iq.discount_type = 'percent'
            THEN iq.qty * iq.client_price * (1 - coalesce(iq.discount_value, 0) / 100)
          WHEN iq.discount_type = 'amount'
            THEN iq.qty * iq.client_price - coalesce(iq.discount_value, 0)
          ELSE iq.qty * iq.client_price
        END AS net,
        -- Fail closed on a legacy 'percent' row, exactly as buildKosztorysTree does.
        CASE WHEN inv.global_discount_type = 'amount' THEN inv.global_discount_value ELSE 0 END
          AS global_discount
      FROM item_qty iq
      JOIN investments inv ON inv.id = iq.investment_id
    )
    SELECT
      investment_id,
      sum(net) AS done_net,
      sum(gross) AS labor_costs_net_from_kosztorys,
      sum(gross - net) + global_discount AS discount_net_from_kosztorys,
      global_discount AS global_discount_net
    FROM priced
    GROUP BY investment_id, global_discount
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    doneNet: num(row.done_net),
    laborCostsNetFromKosztorys: num(row.labor_costs_net_from_kosztorys),
    discountNetFromKosztorys: num(row.discount_net_from_kosztorys),
    globalDiscountNet: num(row.global_discount_net),
  }))
}
