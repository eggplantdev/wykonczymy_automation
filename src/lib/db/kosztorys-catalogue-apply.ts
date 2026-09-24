// No `server-only` here (half of src/lib/db skips it too), for the same reason as
// kosztorys-item-texts.ts: these helpers have to stay importable from a tsx script.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

// What the klucz is rebuilt from server-side. The wire carries ids and field names only, so the
// (opis, j.m.) the katalog is matched on has to come from the row as it stands NOW — a dialog left
// open across a rename must miss, not price the praca off its old name.
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

/** The pozycje named by id, narrowed to one inwestycja — the scope lives in the WHERE, not in trust. */
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
      AND id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql.raw(', '),
      )})
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: row.description == null ? '' : String(row.description),
    unit: row.unit == null ? '' : String(row.unit),
  }))
}

/**
 * One statement per column, whatever the size of the selection — the owner ticks „zaznacz wszystkie"
 * over a kosztorys that can run past a thousand pozycji.
 *
 * The VALUES tuples are cast explicitly: a stawka row may carry `NULL` (taking the katalog's „auto"
 * means DROPPING the nadpisanie, not writing a number), and a literal `NULL` has no type, so a batch
 * whose first row clears the figure would leave Postgres unable to infer the column and reject the
 * whole update — same trap as `setSheetMeasuredQty`.
 *
 * `investments.updated_at` is deliberately NOT bumped: it is the editor's remount latch, and the
 * caller patches its grid in place, so bumping it would throw away the sort and filters the owner
 * had set to find these rows in the first place.
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
