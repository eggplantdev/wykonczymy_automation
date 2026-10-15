import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type UsedKosztorysItemT = {
  investmentId: number
  description: string
  unit: string | null
  catalogueItemId: number | null
}

// „Użyta" (owner, 2026-09-28): a Przedmiar or measured etap work above zero. `> 0`, not the `<> 0`
// of `KOSZTORYS_USED` — a negative quantity is a correction, not a use of the praca. The kosz is
// out; wyceny count, because an offer is where a praca is used first.
export async function selectUsedKosztorysItems(db: DbExecutorT): Promise<UsedKosztorysItemT[]> {
  const { rows } = await db.execute(sql`
    SELECT ki.investment_id, ki.description, ki.unit, ki.catalogue_item_id
    FROM kosztorys_items ki
    JOIN investments i ON i.id = ki.investment_id
    WHERE i.trashed_at IS NULL
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

// The szablony a katalog praca appears in — what an edit or delete in /katalog-prac reaches. Live
// only: a trashed szablon is nowhere the owner would look for the effect.
export async function listTemplateNamesUsingCatalogueItem(
  db: DbExecutorT,
  catalogueItemId: number,
): Promise<string[]> {
  const res = await db.execute(sql`
    SELECT DISTINCT t.name FROM template_items i
    JOIN template_sections s ON s.id = i.section_id
    JOIN templates t ON t.id = s.template_id
    WHERE i.catalogue_item_id = ${catalogueItemId} AND t.trashed_at IS NULL
    ORDER BY t.name
  `)
  return res.rows.map((row) => String(row.name))
}

export async function listTemplateNamesByCatalogueItem(
  db: DbExecutorT,
): Promise<Record<number, string[]>> {
  const res = await db.execute(sql`
    SELECT i.catalogue_item_id, array_agg(DISTINCT t.name ORDER BY t.name) AS names
    FROM template_items i
    JOIN template_sections s ON s.id = i.section_id
    JOIN templates t ON t.id = s.template_id
    WHERE t.trashed_at IS NULL
    GROUP BY i.catalogue_item_id
  `)
  return Object.fromEntries(
    res.rows.map((row) => [Number(row.catalogue_item_id), (row.names as unknown[]).map(String)]),
  )
}
