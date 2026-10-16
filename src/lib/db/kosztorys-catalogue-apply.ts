import { sql } from '@payloadcms/db-postgres'
import { sqlList } from '@/lib/db/sql-list'
import type { DbExecutorT } from '@/lib/db/get-db'

// The wire carries ids and field names only, so the (opis, j.m.) the katalog is matched on has to
// come from the row as it stands NOW — a dialog left open across a rename must miss, not price the
// praca off its old name.
export type CatalogueApplyTargetT = { id: number; description: string; unit: string }

export type CatalogueApplyColumnT =
  | 'clientPrice'
  | 'wToolsOverrideValue'
  | 'ownToolsOverrideValue'
  | 'wToolsOverrideCoeff'
  | 'ownToolsOverrideCoeff'

const COLUMN_NAME: Record<CatalogueApplyColumnT, string> = {
  clientPrice: 'client_price',
  wToolsOverrideValue: 'w_tools_override_value',
  ownToolsOverrideValue: 'own_tools_override_value',
  wToolsOverrideCoeff: 'w_tools_override_coeff',
  ownToolsOverrideCoeff: 'own_tools_override_coeff',
}

export type CatalogueApplyValueT = { id: number; value: number | null }

export async function listItemsForCatalogueApply(
  db: DbExecutorT,
  investmentId: number,
  ids: readonly number[],
): Promise<CatalogueApplyTargetT[]> {
  if (ids.length === 0) return []
  const res = await db.execute(sql`
    SELECT id, description, unit
    FROM kosztorys_items
    WHERE investment_id = ${investmentId}
      AND id IN (${sqlList(ids)})
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: row.description == null ? '' : String(row.description),
    unit: row.unit == null ? '' : String(row.unit),
  }))
}

/**
 * `investments.updated_at` is deliberately NOT bumped: it is the editor's remount latch, and the
 * caller patches its grid in place, so bumping it would throw away the sort and filters the owner
 * had set.
 */
export async function applyCatalogueValues(
  db: DbExecutorT,
  investmentId: number,
  column: CatalogueApplyColumnT,
  rows: readonly CatalogueApplyValueT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(({ id, value }) => sql`(${id}::int, ${value}::numeric)`)
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET ${sql.raw(COLUMN_NAME[column])} = v.value, updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, value)
    WHERE i.id = v.id AND i.investment_id = ${investmentId}
    RETURNING i.id
  `)
  return res.rows.length
}
