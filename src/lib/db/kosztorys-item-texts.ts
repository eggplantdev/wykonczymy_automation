// No `server-only` here (half of src/lib/db skips it too): the bulk script runs these same helpers
// under tsx, where that import throws.
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

// The two hand-typed text columns travel together: one button cleans both, and a praca with a blank
// opis can still carry a j.m. worth tidying.
export type ItemTextRowT = { id: number; description: string | null; unit: string | null }

export async function getItemTexts(db: DbExecutorT, investmentId: number): Promise<ItemTextRowT[]> {
  const res = await db.execute(sql`
    SELECT id, description, unit
    FROM kosztorys_items
    WHERE investment_id = ${investmentId}
  `)
  return res.rows.map((row) => ({
    id: Number(row.id),
    description: row.description == null ? null : String(row.description),
    unit: row.unit == null ? null : String(row.unit),
  }))
}

/** One statement, because a kosztorys runs to hundreds of rows and one button drives all of them. */
export async function setItemTexts(
  db: DbExecutorT,
  investmentId: number,
  rows: readonly ItemTextRowT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(
    ({ id, description, unit }) => sql`(${id}::int, ${description}::text, ${unit}::text)`,
  )
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET description = v.description, unit = v.unit, updated_at = now()
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, description, unit)
    WHERE i.id = v.id AND i.investment_id = ${investmentId}
    RETURNING i.id
  `)
  // The editor reseeds its grid off the investment's revision token — the same reason
  // setSheetMeasuredQty bumps it.
  if (res.rows.length > 0)
    await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
  return res.rows.length
}
