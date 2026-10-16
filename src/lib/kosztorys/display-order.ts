import 'server-only'
import { z } from 'zod'
import { sql } from '@payloadcms/db-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'

const ORDER_SCOPES = {
  'kosztorys-sections': { table: sql.raw('kosztorys_sections'), owner: sql.raw('investment_id') },
  'kosztorys-items': { table: sql.raw('kosztorys_items'), owner: sql.raw('section_id') },
} as const

export type OrderScopeT = keyof typeof ORDER_SCOPES

export type DisplayOrderRefT = { id: number; displayOrder: number }
// A duplicate id is still refused: it makes the VALUES join ambiguous (two rows claim one target) and
// it makes the sequence itself meaningless.
export const renumberDisplayOrderSchema = z
  .array(z.number().int())
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate id' })

export async function nextSectionDisplayOrder(
  db: DbExecutorT,
  investmentId: number,
): Promise<number> {
  const res = await db.execute(sql`
    SELECT COALESCE(MAX(display_order) + 1, 0) AS next
    FROM kosztorys_sections WHERE investment_id = ${investmentId}
  `)
  return Number(res.rows[0]?.next ?? 0)
}

// Runs on a caller-owned transaction
// handle: the shift and the create it opens room for must commit together, or a double-fired insert
// at the same index interleaves and lands two rows on one display_order (EX-464).
export async function shiftDisplayOrderFrom(
  db: DbExecutorT,
  scope: OrderScopeT,
  ownerId: number,
  at: number,
): Promise<void> {
  const { table, owner } = ORDER_SCOPES[scope]
  await db.execute(sql`
    UPDATE ${table} SET display_order = display_order + 1
    WHERE id IN (
      SELECT id FROM ${table}
      WHERE ${owner} = ${ownerId} AND display_order >= ${at}
      ORDER BY id FOR UPDATE
    )
  `)
}

export const insertDirectionSchema = z.enum(['above', 'below'])

export type InsertDirectionT = z.infer<typeof insertDirectionSchema>

// Where a row sits, read UNDER the lock on its whole owner block: `shiftDisplayOrderFrom` and
// `renumberDisplayOrder` acquire in ascending id order too, so no pair of them can form a cycle (EX-632).
async function lockedPositionOf(
  db: DbExecutorT,
  scope: OrderScopeT,
  rowId: number,
): Promise<{ ownerId: number; displayOrder: number } | null> {
  const { table, owner } = ORDER_SCOPES[scope]
  const res = await db.execute(sql`
    SELECT id, ${owner} AS owner_id, display_order FROM ${table}
    WHERE ${owner} = (SELECT ${owner} FROM ${table} WHERE id = ${rowId})
    ORDER BY id FOR UPDATE
  `)
  const row = res.rows.find((r) => Number(r.id) === rowId)
  if (!row) return null
  return { ownerId: Number(row.owner_id), displayOrder: Number(row.display_order) }
}

export async function resolveInsertSlot(
  db: DbExecutorT,
  scope: OrderScopeT,
  anchorId: number,
  dir: InsertDirectionT,
): Promise<{ ownerId: number; at: number } | null> {
  const fresh = await lockedPositionOf(db, scope, anchorId)
  if (!fresh) return null
  return {
    ownerId: fresh.ownerId,
    at: dir === 'above' ? fresh.displayOrder : fresh.displayOrder + 1,
  }
}

// The single statement is load-bearing: a half-applied renumber leaves rows sharing a display_order
// (there is no unique constraint) and the reloaded order goes non-deterministic.
export async function renumberDisplayOrder(
  db: DbExecutorT,
  scope: OrderScopeT,
  refs: DisplayOrderRefT[],
): Promise<void> {
  const { table } = ORDER_SCOPES[scope]
  const ids = sqlList(refs.map((r) => r.id))
  const values = sql.join(
    refs.map((r) => sql`(${r.id}::int, ${r.displayOrder}::int)`),
    sql.raw(', '),
  )
  await db.execute(sql`
    UPDATE ${table} AS t
    SET display_order = v.ord, updated_at = now()
    FROM (VALUES ${values}) AS v(id, ord)
    WHERE t.id = v.id
      AND t.id IN (SELECT id FROM ${table} WHERE id IN (${ids}) ORDER BY id FOR UPDATE)
  `)
}
