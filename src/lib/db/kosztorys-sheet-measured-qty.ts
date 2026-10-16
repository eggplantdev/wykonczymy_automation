import 'server-only'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'

export type SheetMeasuredQtyRowT = { id: number; qty: number | null }

/**
 * The VALUES tuples are cast explicitly: a literal `NULL` has no type, so a batch whose first row
 * clears the figure would leave Postgres unable to infer the column and reject the whole update.
 */
export async function setSheetMeasuredQty(
  db: DbExecutorT,
  investmentId: number,
  rows: readonly SheetMeasuredQtyRowT[],
): Promise<number> {
  if (rows.length === 0) return 0
  const values = rows.map(({ id, qty }) => sql`(${id}::int, ${qty}::numeric)`)
  const res = await db.execute(sql`
    UPDATE kosztorys_items AS i
    SET sheet_measured_qty = v.qty
    FROM (VALUES ${sql.join(values, sql.raw(', '))}) AS v(id, qty)
    WHERE i.id = v.id AND i.investment_id = ${investmentId}
    RETURNING i.id
  `)
  // The editor reseeds its grid off the investment's revision token, so a write that moves rows
  // without moving that token leaves the owner looking at the pre-write figures until a hard reload.
  if (res.rows.length > 0)
    await db.execute(sql`UPDATE investments SET updated_at = now() WHERE id = ${investmentId}`)
  return res.rows.length
}
