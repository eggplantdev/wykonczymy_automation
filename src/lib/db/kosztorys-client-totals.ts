import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { KosztorysClientTotalsT } from '@/lib/kosztorys/settlement-client-totals'
import type { DbExecutorT } from './get-db'

// The client-view pair for EVERY investment at once, folded in Postgres — one row per investment,
// never one per kosztorys item.
//
// Why the aggregate rather than reading the rows and running the TS formula (the shape
// `selectKosztorysTreeData` uses for a single investment): the listing needs two scalars per
// investment, and shipping the rows to get them does not scale. Measured on a synthetic
// 1000-investment dataset (300 items × 3 etapy each): the rows are 10 MB at 200 investments and
// 49 MB at 1000, crossing the wire on every cache miss to produce 2000 numbers. Round-trip count is
// the Neon cost driver (see kosztorys-tree.ts) — that argues for one query, not for an unbounded
// payload inside it.
//
// The cost this buys is that the client-view formula now exists twice, here and in TS. TS is the
// reference implementation; this is the copy, pinned against it by a DB-backed parity spec
// (__tests__/lib/db/kosztorys-client-totals.test.ts). `lessons.md`'s two-planes-both-green drift is
// exactly the failure mode that spec exists to make impossible.
//
// The formula collapses this far because on the path to these two figures the client view neither
// filters nor rounds: `stagesForView(stages, 'client')` returns every etap (settlement-view.ts), and
// `clientTotalsFromSubtotals` reads only `net` and `discount` — the rounded fields of
// `sectionSubtotalsForView` (share, completionRatio) belong to other consumers.

export type KosztorysClientTotalsRowT = KosztorysClientTotalsT & { investmentId: number }

const num = (v: unknown): number => Number(v ?? 0)

/**
 * Investments with at least one kosztorys item, one row each. An investment with no items is simply
 * absent, which the reading turns into zeros — that is the answer: no kosztorys, no robocizna.
 */
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
        -- „Pomiar z natury" IS the etap sum (EX-494).
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
          -- netForQtyForView: zero quantity is worth zero. Without this an 'amount' rabat turns an
          -- untouched row into −discountValue.
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
      -- laborCostsNetFromKosztorys = doneNet + Σ per-item rabat, and per-item rabat is gross − net by construction,
      -- so the pre-rabat figure is Σ gross. Written as the sum it is, not as the identity it expands
      -- to, because the identity has to hold in both languages.
      sum(gross) AS labor_costs_net_from_kosztorys,
      sum(gross - net) + global_discount AS discount_net_from_kosztorys,
      global_discount AS global_discount_net
    FROM priced
    -- global_discount is per investment, so grouping by it adds no groups — it just makes the column
    -- selectable without wrapping a constant in an aggregate.
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
