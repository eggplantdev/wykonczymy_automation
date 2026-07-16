import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sql } from '@payloadcms/db-vercel-postgres'

// The guards live in the server action, so we run the REAL action against the REAL DB and
// assert PERSISTED STATE (does the row survive?), not the action's return value — a success
// result could hide a failed write, and a block is only real if the row is still there.
//
// requireAuth needs a request/cookie we don't have in node, so it's mocked to pass; the
// cache revalidation is mocked because it calls next/cache outside a request context.
vi.mock('server-only', () => ({}))
// The action's own payload.delete fires the collection's afterDelete revalidate hook, which
// calls next/cache's revalidateTag — that throws outside a request/static-generation store.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
// A real user id (looked up in beforeAll), not a hardcoded 1: removeSectionAction now takes a
// pre-delete snapshot whose taken_by FKs users.id, and a fresh prod-dump test DB has no user 1.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { removeItemAction, removeSectionAction } = await import('@/lib/actions/kosztorys')

// Gated like test:parity: skips with no DB env (portable), FAILS if env is set but the DB is
// unreachable. Run against the local DB with `--env-file=.env`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys delete guards — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  // Every section/stage created by a test, cleaned up after it (section cascades items +
  // stage_progress; stage cascades its own progress rows).
  const createdSections: number[] = []
  const createdStages: number[] = []
  // Spread (not inlined) so payload's create overload doesn't mis-resolve to the draft branch.
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    // sort by id (oldest, a prod-dump investment) — parallel S-06 specs create+delete transient
    // investments with the highest ids, so an unsorted limit:1 can borrow one that vanishes mid-test.
    const inv = await payload.find({
      collection: 'investments',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const first = inv.docs[0]
    if (!first) throw new Error('no investment in the DB to attach test fixtures to')
    investmentId = Number(first.id)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the pre-delete snapshot to')
    authState.userId = Number(firstUser.id)
  })

  afterEach(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
    for (const id of createdStages.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_stages WHERE id = ${id}`)
    }
  })

  async function createSection(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'guard-test',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      overrideAccess: true,
      ...ctx,
    })
    createdSections.push(Number(section.id))
    return Number(section.id)
  }

  async function createItem(
    sectionId: number,
    data: { measuredQty?: number; plannedQty?: number; clientPrice?: number } = {},
  ): Promise<number> {
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        plannedQty: data.plannedQty ?? 0,
        measuredQty: data.measuredQty ?? 0,
        discountValue: 0,
        clientPrice: data.clientPrice ?? 0,
        hiddenInExport: false,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(item.id)
  }

  async function createStage(): Promise<number> {
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 9000 + createdStages.length },
      overrideAccess: true,
      ...ctx,
    })
    createdStages.push(Number(stage.id))
    return Number(stage.id)
  }

  async function itemExists(id: number): Promise<boolean> {
    const res = await db.execute(sql`SELECT 1 FROM kosztorys_items WHERE id = ${id} LIMIT 1`)
    return res.rows.length > 0
  }

  async function sectionExists(id: number): Promise<boolean> {
    const res = await db.execute(sql`SELECT 1 FROM kosztorys_sections WHERE id = ${id} LIMIT 1`)
    return res.rows.length > 0
  }

  // Stage progress is the only thing "populated" means now. A leftover measured_qty must NOT wall
  // the row off: nobody can type that number any more, so blocking on it would be a dead end.
  it('(a) deletes an item carrying only a stale measured_qty (no stage progress)', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId, { measuredQty: 5 })

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
  })

  it('(b) blocks deleting an item with recorded stage progress (qty_done <> 0) — row survives', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId) // pomiar 0
    const stageId = await createStage()
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      VALUES (${itemId}, ${stageId}, 3, now(), now())
    `)

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(false)
    expect(await itemExists(itemId)).toBe(true)
  })

  it('(c) deletes a plan-only item (przedmiar + price, no pomiar / progress)', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId, { plannedQty: 10, clientPrice: 99 })

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
  })

  it('(d) blocks deleting a section holding an item with stage progress — section + item survive', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId)
    const stageId = await createStage()
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      VALUES (${itemId}, ${stageId}, 7, now(), now())
    `)

    const res = await removeSectionAction(sectionId)

    expect(res.success).toBe(false)
    expect(await sectionExists(sectionId)).toBe(true)
    expect(await itemExists(itemId)).toBe(true)
  })

  it('(e) deletes an empty / plan-only section', async () => {
    const sectionId = await createSection()
    await createItem(sectionId, { plannedQty: 4, clientPrice: 50 }) // plan-only

    const res = await removeSectionAction(sectionId)

    expect(res.success).toBe(true)
    expect(await sectionExists(sectionId)).toBe(false)
  })
})
