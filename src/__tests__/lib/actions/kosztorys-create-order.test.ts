import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// A structure-create invariant of the kosztorys actions, driven against the REAL DB and asserting
// PERSISTED display_order rows, not the action's return value: append (addItemAction) must pick a
// slot that can't collide with a surviving row. removeItemAction leaves gaps, so a count-based
// next-order collides after any middle delete (add 3 → delete middle → append reuses the count and
// lands on a live row).
//
// Same mock surface as the sibling action specs: requireAuth needs a request/cookie we lack in node,
// and revalidation touches next/cache outside a request context.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { addItemAction, removeItemAction } = await import('@/lib/actions/kosztorys')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys create-order integrity (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let sharedInvestmentId: number
  const createdSections: number[] = []
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    sharedInvestmentId = await createTestInvestment(payload, `create-order-test-${Date.now()}`)
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

  afterAll(async () => {
    await deleteTestInvestment(payload, sharedInvestmentId)
  })

  afterEach(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  async function createSection(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: sharedInvestmentId,
        name: 'order-test',
        displayOrder: 0,
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
