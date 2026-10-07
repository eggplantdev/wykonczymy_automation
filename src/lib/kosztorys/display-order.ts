import 'server-only'
import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'

// Sections and items each had their own copy of the insert-shift, and the copies drifted on
// transaction policy alone (EX-578) — one scope-parameterised home is what stops that.

// A row's owner column is fixed by its table (a section is ordered within its investment, an item
// within its section), so the two travel together keyed by the Payload collection slug — a caller
// can't pair the wrong column with a table.
const ORDER_SCOPES = {
  'kosztorys-sections': { table: sql.raw('kosztorys_sections'), owner: sql.raw('investment_id') },
  'kosztorys-items': { table: sql.raw('kosztorys_items'), owner: sql.raw('section_id') },
} as const

export type OrderScopeT = keyof typeof ORDER_SCOPES

// A row and the display_order it should take. No schema: every ref is derived server-side inside a
// transaction (the bake's own per-section numbering), so nothing here ever crosses the wire to be
// validated.
export type DisplayOrderRefT = { id: number; displayOrder: number }
// The bake's payload: the ids in the order the sheet should store them. The numbers themselves are
// the server's business — it groups the ids by their own section and assigns 0…n-1 within each, so
// no caller can invent an index that collides inside a section.
//
// A duplicate id is still refused: it makes the VALUES join ambiguous (two rows claim one target) and
// it makes the sequence itself meaningless.
export const renumberDisplayOrderSchema = z
  .array(z.number().int())
  .min(1)
  .refine((ids) => new Set(ids).size === ids.length, { message: 'Duplicate id' })

// Append slot for a new row = MAX(display_order)+1, not COUNT — a delete leaves a gap, so counting
// would collide with a surviving row.
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

// Opens the slot at `at` by pushing the owner's tail down one, so a create can land there. Bounded by
// the OWNER's row count — one investment's sections or one section's items, never the whole sheet
// (1000+ rows). Runs on a caller-owned transaction
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

// Where a row sits, read UNDER the lock on its whole owner block — the position `resolveInsertSlot`
// starts from, and what lets its slot read be a plain SELECT and still be atomic with the UPDATE that
// follows: `shiftDisplayOrderFrom` and `renumberDisplayOrder` acquire in ascending id order too, so no
// pair of them can form a cycle (EX-632). The lock is bounded by ONE owner — an investment's sections
// or a section's items — never the whole sheet.
//
// Lock and read are ONE statement on purpose: the owner is resolved inside the lock's own predicate,
// so there is no window between learning which block to hold and reading a position out of it. A row
// missing from the locked set (deleted, or reparented by something that doesn't exist today) simply
// yields null — the resolvers fail closed rather than act on a block they don't hold.
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

// Resolves „wstaw powyżej/poniżej <anchor>" into the owner whose block is being inserted into and the
// slot `shiftDisplayOrderFrom` should open. Read server-side because the anchor's own display_order
// is the input, and only the transaction can see its current value.
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

// Rewrites a whole block's display_order in ONE statement — what „Zapisz kolejność" needs.
//
// The single statement is load-bearing: a half-applied renumber leaves rows sharing a display_order
// (there is no unique constraint) and the reloaded order goes non-deterministic. It locks through the
// same `ORDER BY id FOR UPDATE` subquery as shiftDisplayOrderFrom, so the two cannot deadlock (EX-632).
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
