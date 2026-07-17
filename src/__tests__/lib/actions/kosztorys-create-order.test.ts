import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'

// Two structure-create invariants of the kosztorys actions, driven against the REAL DB and asserting
// PERSISTED state (display_order rows / section counts), not the action's return value:
//   CR1 — append (addItemAction/addSectionAction) must pick a slot that can't collide with a
//         surviving row. removeItemAction leaves gaps, so a count-based next-order collides after
//         any middle delete (add 3 → delete middle → append reuses the count and lands on a live row).
//   CR2 — seedBlankSectionAction must be idempotent: the client only opens the seeding dialog on an
//         empty kosztorys, but a double-submit / stale tab could reach it after a section exists.
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { addItemAction, removeItemAction, seedBlankSectionAction } =
  await import('@/lib/actions/kosztorys')
const { createInvestmentAction } = await import('@/lib/actions/investments')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys create-order integrity (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let sharedInvestmentId: number
  const createdSections: number[] = []
  const createdInvestmentNames: string[] = []
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    // Oldest investment (a prod-dump row) for the item-order test; parallel specs churn the newest.
    const inv = await payload.find({
      collection: 'investments',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const first = inv.docs[0]
    if (!first) throw new Error('no investment in the DB to attach test fixtures to')
    sharedInvestmentId = Number(first.id)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the action to')
    authState.userId = Number(firstUser.id)
  })

  afterEach(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  afterAll(async () => {
    for (const name of createdInvestmentNames.splice(0)) {
      const found = await payload.find({
        collection: 'investments',
        where: { name: { equals: name } },
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of found.docs) {
        await payload.delete({ collection: 'investments', id: doc.id, ...ctx })
      }
    }
  })

  async function createSection(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: sharedInvestmentId,
        name: 'order-test',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      overrideAccess: true,
      ...ctx,
    })
    createdSections.push(Number(section.id))
    return Number(section.id)
  }

  async function sectionItemOrders(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.display_order))
  }

  async function sectionCount(investmentId: number): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_sections WHERE investment_id = ${investmentId}`,
    )
    return Number(res.rows[0].n)
  }

  async function itemCount(investmentId: number): Promise<number> {
    const res = await db.execute(
      sql`SELECT COUNT(*) AS n FROM kosztorys_items WHERE investment_id = ${investmentId}`,
    )
    return Number(res.rows[0].n)
  }

  async function investmentIdByName(name: string): Promise<number | null> {
    const res = await db.execute(sql`SELECT id FROM investments WHERE name = ${name} LIMIT 1`)
    return res.rows.length > 0 ? Number(res.rows[0].id) : null
  }

  describe('append order — addItemAction never collides on display_order (CR1)', () => {
    it('appending after a middle delete lands on a free slot, not a surviving row', async () => {
      const sectionId = await createSection()

      // Add 3 blank items → display_order 0,1,2.
      await addItemAction(sectionId)
      const middle = await addItemAction(sectionId)
      await addItemAction(sectionId)
      expect(middle.success).toBe(true)

      // Delete the middle one (blank → passes the delete guard) → leaves {0,2}, a gap.
      const del = await removeItemAction(middle.success ? middle.data.id : 0)
      expect(del.success).toBe(true)

      // Append again. Count-based order would reuse 2 and collide with the surviving order-2 row.
      const appended = await addItemAction(sectionId)
      expect(appended.success).toBe(true)

      const orders = await sectionItemOrders(sectionId)
      expect(orders).toHaveLength(3)
      // The regression: every surviving row has a distinct display_order.
      expect(new Set(orders).size).toBe(orders.length)
      // And the new row appended past the tail (max+1), not into the gap.
      if (appended.success) expect(appended.data.displayOrder).toBe(Math.max(...orders))
    })
  })

  describe('seedBlankSectionAction idempotency (CR2)', () => {
    it('a second seed on an already-seeded investment is a no-op', async () => {
      const name = 'cr2-seed-idempotency-test'
      createdInvestmentNames.push(name)
      // Bogus presetId → the investment lands with an empty kosztorys (0 sections).
      const created = await createInvestmentAction({
        name,
        address: '',
        phone: '',
        email: '',
        contactPerson: '',
        notes: '',
        review: '',
        status: 'active',
        presetId: '2000000000',
      })
      expect(created.success).toBe(true)
      const investmentId = await investmentIdByName(name)
      expect(investmentId).not.toBeNull()

      const first = await seedBlankSectionAction(investmentId!)
      expect(first.success).toBe(true)
      expect(await sectionCount(investmentId!)).toBe(1)
      expect(await itemCount(investmentId!)).toBe(1)

      // Second submit must NOT add a duplicate section/item at display_order 0.
      const second = await seedBlankSectionAction(investmentId!)
      expect(second.success).toBe(true)
      expect(await sectionCount(investmentId!)).toBe(1)
      expect(await itemCount(investmentId!)).toBe(1)
    })
  })
})
