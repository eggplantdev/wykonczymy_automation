import 'server-only'
import { z } from 'zod'
import { sql } from '@payloadcms/db-vercel-postgres'
import type { DbExecutorT } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'

// Sections and items each had their own copy of the insert-shift and the ▲▼ swap, and the copies
// drifted on transaction policy alone (EX-578) — one scope-parameterised home is what stops that.

// A row's owner column is fixed by its table (a section is ordered within its investment, an item
// within its section), so the two travel together keyed by the Payload collection slug — a caller
// can't pair the wrong column with a table.
const ORDER_SCOPES = {
  'kosztorys-sections': { table: sql.raw('kosztorys_sections'), owner: sql.raw('investment_id') },
  'kosztorys-items': { table: sql.raw('kosztorys_items'), owner: sql.raw('section_id') },
} as const

export type OrderScopeT = keyof typeof ORDER_SCOPES

// A row and the display_order it should take. No schema: every ref is derived server-side inside a
// transaction (from `resolveOrderSwap` or the bake's own per-section numbering), so nothing here
// ever crosses the wire to be validated.
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
// the OWNER's row count — the whole-sheet concern that made ▲▼ a neighbour swap (1000+ rows) doesn't
// apply to one investment's sections or one section's items. Runs on a caller-owned transaction
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

const moveDirectionSchema = z.enum(['up', 'down'])
export const insertDirectionSchema = z.enum(['above', 'below'])

export type MoveDirectionT = z.infer<typeof moveDirectionSchema>
export type InsertDirectionT = z.infer<typeof insertDirectionSchema>

export const moveOrderSchema = z.object({
  rowId: z.number().int(),
  dir: moveDirectionSchema,
})

// Where a row sits, read UNDER the lock on its whole owner block — the position both resolvers below
// start from, and what lets their neighbour/slot reads be plain SELECTs and still be atomic with the
// UPDATE that follows: `shiftDisplayOrderFrom`, `swapDisplayOrder` and `renumberDisplayOrder` all
// acquire in ascending id order too, so no pair of them can form a cycle (EX-632). The lock is
// bounded by ONE owner — an investment's sections or a section's items — never the whole sheet.
//
// Its width was questioned and measured (EX-700, 2026-08-17): on a 100-item section — the modelled
// shape, 10 sections × 100 — a continuous ▲▼ burst moved a concurrent autosave from p50 6.7 → 7.9 ms
// and p95 9.8 → 12.1 ms. Narrowing it to the anchor + its rank-adjacent neighbour buys that
// millisecond and costs the property below, so don't. If a section's row count ever grows by an order
// of magnitude, re-measure with a throwaway spec before believing these numbers still hold.
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

// Resolves a ▲▼ gesture into the two rows that must exchange places, reading the neighbour from the
// same transaction that writes the swap so no cached integer can go stale between the two.
//
// Returns null at the edge (top row moved up, bottom row moved down) — a no-op, not an error — and
// null for an id the caller doesn't own a row for.
async function resolveOrderSwap(
  db: DbExecutorT,
  scope: OrderScopeT,
  rowId: number,
  dir: MoveDirectionT,
): Promise<{ anchor: DisplayOrderRefT; neighbor: DisplayOrderRefT } | null> {
  const { table, owner } = ORDER_SCOPES[scope]
  const fresh = await lockedPositionOf(db, scope, rowId)
  if (!fresh) return null
  // Adjacency is by display_order rank, not by arithmetic — a delete leaves gaps, so "the next one
  // up" is the greatest order strictly below, not `display_order − 1`.
  const res =
    dir === 'up'
      ? await db.execute(sql`
          SELECT id, display_order FROM ${table}
          WHERE ${owner} = ${fresh.ownerId} AND display_order < ${fresh.displayOrder}
          ORDER BY display_order DESC LIMIT 1
        `)
      : await db.execute(sql`
          SELECT id, display_order FROM ${table}
          WHERE ${owner} = ${fresh.ownerId} AND display_order > ${fresh.displayOrder}
          ORDER BY display_order ASC LIMIT 1
        `)
  const neighbor = res.rows[0]
  if (!neighbor) return null
  return {
    anchor: { id: rowId, displayOrder: fresh.displayOrder },
    neighbor: { id: Number(neighbor.id), displayOrder: Number(neighbor.display_order) },
  }
}

// Resolves „wstaw powyżej/poniżej <anchor>" into the owner whose block is being inserted into and the
// slot `shiftDisplayOrderFrom` should open. Same reason as above for reading it server-side: the
// anchor's own display_order is the input, and only the transaction can see its current value.
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

// Exchanges two rows' display_order in ONE statement, so ▲▼ moves a row without renumbering the
// block. Each ref carries the NEW display_order its row should take on.
//
// The single statement is load-bearing: a half-applied swap would leave both rows on the same
// display_order (there is no unique constraint) and the reloaded order would be non-deterministic.
//
// It does NOT make the swap deadlock-proof — one UPDATE still takes its row locks one at a time, in
// plan order (EX-632). That is why both this and shiftDisplayOrderFrom lock through `ORDER BY id FOR
// UPDATE`: same acquisition order on both sides, so they cannot form a cycle. Without it the shift's
// heap-order scan and this statement's id-order scan diverge as soon as MVCC moves an updated row to
// the back of the heap, and one side aborts with 40P01 — silently, because ▲▼ fires this WITHOUT
// awaiting and with no error handling, leaving the grid showing an order the DB never stored.
async function swapDisplayOrder(
  db: DbExecutorT,
  scope: OrderScopeT,
  first: DisplayOrderRefT,
  second: DisplayOrderRefT,
): Promise<void> {
  const { table } = ORDER_SCOPES[scope]
  await db.execute(sql`
    UPDATE ${table}
    SET display_order = CASE id
          WHEN ${first.id} THEN ${first.displayOrder}::int
          ELSE ${second.displayOrder}::int
        END,
        updated_at = now()
    WHERE id IN (
      SELECT id FROM ${table} WHERE id IN (${first.id}, ${second.id}) ORDER BY id FOR UPDATE
    )
  `)
}

// ▲▼ end to end: find the rank-adjacent row and exchange places with it. The crossing of the two
// display_orders (each row takes the other's) lives here rather than at the call sites, so a caller
// only names a row and a direction — sections and items had already drifted apart once by each
// spelling the same exchange out for itself (EX-578).
//
// Returns false at the edge — no neighbour, nothing written. A no-op, not a failure.
export async function moveRowOneStep(
  db: DbExecutorT,
  scope: OrderScopeT,
  rowId: number,
  dir: MoveDirectionT,
): Promise<boolean> {
  const pair = await resolveOrderSwap(db, scope, rowId, dir)
  if (!pair) return false
  await swapDisplayOrder(
    db,
    scope,
    { id: pair.anchor.id, displayOrder: pair.neighbor.displayOrder },
    { id: pair.neighbor.id, displayOrder: pair.anchor.displayOrder },
  )
  return true
}

// Rewrites a whole block's display_order in ONE statement — what „Zapisz kolejność" needs, where the
// ▲▼ swap would take O(n²) neighbour exchanges to reach the same order.
//
// One statement for the same reason as swapDisplayOrder: a half-applied renumber leaves rows sharing
// a display_order and the reloaded order goes non-deterministic. And it locks through the same
// `ORDER BY id FOR UPDATE` subquery, so it cannot deadlock against shiftDisplayOrderFrom (EX-632).
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
