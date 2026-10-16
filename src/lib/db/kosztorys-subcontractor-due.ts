import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import { DEFAULT_COEFFS } from '@/lib/kosztorys/constants'
import type { SubcontractorSettlementT } from '@/lib/kosztorys/subcontractor-due'
import type { DbExecutorT } from './get-db'

// Rabat is absent by construction and must stay absent: a rabat is a client concession the crew is
// still owed past, so no discount column appears anywhere below.

export type KosztorysSubcontractorDueRowT = SubcontractorSettlementT & { investmentId: number }

export const subcontractorLinesCte = sql`
  lines AS (
    SELECT
      ks.investment_id,
      ks.id AS stage_id,
      ks.plane,
      sp.qty_done,
      -- NO coalesce on the stawka: NULL is the signal, and folding it to 0 would price every auto
      -- praca at zero złotych (EX-766).
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
    -- stage_progress carries no investment column, so the item is scoped explicitly: without it a
    -- row pairing an etap and an item from two different investments would be priced into one of
    -- them at the other's coefficients.
    JOIN kosztorys_items ki ON ki.id = sp.item_id AND ki.investment_id = ks.investment_id
    JOIN investments inv ON inv.id = ks.investment_id
  )
`

export const subcontractorDueColumns = sql`
  coalesce(sum(qty_done * price) FILTER (WHERE plane IS NOT NULL), 0) AS due,
  coalesce(bool_or(plane IS NULL AND qty_done <> 0), false) AS has_unconfirmed_plane
`

export async function selectKosztorysSubcontractorDue(
  db: DbExecutorT,
): Promise<KosztorysSubcontractorDueRowT[]> {
  const res = await db.execute(sql`
    WITH ${subcontractorLinesCte}
    SELECT investment_id, ${subcontractorDueColumns}
    FROM lines
    GROUP BY investment_id
  `)

  return res.rows.map((row) => ({
    investmentId: Number(row.investment_id),
    due: Number(row.due ?? 0),
    hasUnconfirmedPlane: Boolean(row.has_unconfirmed_plane),
  }))
}
