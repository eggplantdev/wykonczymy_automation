import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { DbExecutorT } from './get-db'

// What the crew is owed, for EVERY investment at once — one row per investment, never one per etap.
//
// Same trade as `kosztorys-client-totals.ts`, for the same reason: the listing needs one scalar and a
// flag per investment, and shipping the rows to compute them does not scale (49 MB at 1000
// investments). The cost is that the settlement formula now exists twice. `subcontractor-due.ts` is
// the reference implementation; this is the copy, pinned against it by a DB-backed parity spec
// (__tests__/lib/db/kosztorys-subcontractor-due.test.ts) — the two-planes-both-green drift
// `lessons.md` records is exactly what that spec exists to make impossible.
//
// Rabat is absent by construction and must stay absent: a rabat is a client concession the crew is
// still owed past, so no discount column appears anywhere below.

export type KosztorysSubcontractorDueRowT = SubcontractorSettlementT & { investmentId: number }

/**
 * Investments with at least one etap holding executed work, one row each. An investment with no
 * executed work is simply absent, which the caller reads as `due: 0` with the flag down — the same
 * answer the TS formula gives for an empty settlement.
 */
export async function selectKosztorysSubcontractorDue(
  db: DbExecutorT,
): Promise<KosztorysSubcontractorDueRowT[]> {
  const res = await db.execute(sql`
    WITH lines AS (
      SELECT
        ks.investment_id,
        ks.plane,
        sp.qty_done,
        -- subcontractorPrice / priceSourceOf (calc.ts): a praca's own mnożnik wins, then its kwota,
        -- then „auto" — client × the investment's coefficient for that plane. The branch order IS the
        -- precedence, so the mnożnik has to come first. Written per plane rather than once over a
        -- picked column, because the two are disjoint columns. NO coalesce on the stawka: NULL is the
        -- signal, and folding it to 0 would price every auto praca at zero złotych (EX-766).
        CASE ks.plane
          WHEN 'w_tools' THEN
            CASE
              WHEN ki.w_tools_override_coeff IS NOT NULL
                THEN ki.client_price * ki.w_tools_override_coeff
              WHEN ki.w_tools_override_value IS NOT NULL THEN ki.w_tools_override_value
              ELSE ki.client_price * coalesce(inv.w_tools_coeff, ${DEFAULT_COEFFS.wTools})
            END
          WHEN 'own_tools' THEN
            CASE
              WHEN ki.own_tools_override_coeff IS NOT NULL
                THEN ki.client_price * ki.own_tools_override_coeff
              WHEN ki.own_tools_override_value IS NOT NULL THEN ki.own_tools_override_value
              ELSE ki.client_price * coalesce(inv.own_tools_coeff, ${DEFAULT_COEFFS.ownTools})
            END
        END AS price
      FROM kosztorys_stages ks
      JOIN stage_progress sp ON sp.stage_id = ks.id
      -- stage_progress carries no investment column, so the item is scoped explicitly rather than
      -- inherited from the etap: without it a row pairing an etap and an item from two different
      -- investments would be priced into one of them at the other's coefficients.
      JOIN kosztorys_items ki ON ki.id = sp.item_id AND ki.investment_id = ks.investment_id
      JOIN investments inv ON inv.id = ks.investment_id
    )
    SELECT
      investment_id,
      -- A plane-less etap contributes NOTHING rather than a guessed price; the flag below is what
      -- says the sum is short.
      coalesce(sum(qty_done * price) FILTER (WHERE plane IS NOT NULL), 0) AS due,
      -- Gated on the etap actually holding qty, exactly as the TS is: a freshly added empty etap
      -- with no rozliczenie would otherwise claim money is missing that does not exist yet.
      coalesce(bool_or(plane IS NULL AND qty_done <> 0), false) AS has_unconfirmed_plane
    FROM lines
    GROUP BY investment_id
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    due: Number(row.due ?? 0),
    hasUnconfirmedPlane: Boolean(row.has_unconfirmed_plane),
  }))
}
