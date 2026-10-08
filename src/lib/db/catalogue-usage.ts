import 'server-only'
import { sql } from '@payloadcms/db-vercel-postgres'
import { TEMPLATE_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import type { DbExecutorT } from '@/lib/db/get-db'

export type UsedKosztorysItemT = {
  investmentId: number
  description: string
  unit: string | null
  catalogueItemId: number | null
}

// „Użyta" (owner, 2026-09-28): a Przedmiar or measured etap work above zero. `> 0`, not the `<> 0`
// of `KOSZTORYS_USED` — a negative quantity is a correction, not a use of the praca. Szablony and
// the kosz are out; wyceny count, because an offer is where a praca is used first.
export async function selectUsedKosztorysItems(db: DbExecutorT): Promise<UsedKosztorysItemT[]> {
  const { rows } = await db.execute(sql`
    SELECT ki.investment_id, ki.description, ki.unit, ki.catalogue_item_id
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    WHERE i.status <> ${TEMPLATE_INVESTMENT_STATUS} AND i.trashed_at IS NULL
      AND btrim(coalesce(ki.description, '')) <> ''
      AND (ki.planned_qty > 0 OR COALESCE(ki.current_planned_qty, 0) > 0
           OR EXISTS (SELECT 1 FROM stage_progress sp WHERE sp.item_id = ki.id AND sp.qty_done > 0))
  `)
  return rows.map((row) => ({
    investmentId: Number(row.investment_id),
    description: String(row.description ?? ''),
    unit: row.unit === null || row.unit === undefined ? null : String(row.unit),
    catalogueItemId:
      row.catalogue_item_id === null || row.catalogue_item_id === undefined
        ? null
        : Number(row.catalogue_item_id),
  }))
}
