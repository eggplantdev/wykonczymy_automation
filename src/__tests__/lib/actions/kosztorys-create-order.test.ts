import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { appendAt } from '@/__tests__/helpers/new-item-input'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { addItemAction, removeItemAction } = await import('@/lib/actions/kosztorys')

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

    await addItemAction(appendAt(sectionId))
    const middle = await addItemAction(appendAt(sectionId))
    await addItemAction(appendAt(sectionId))
    expect(middle.success).toBe(true)

    const del = await removeItemAction(middle.success ? middle.data.item.id : 0)
    expect(del.success).toBe(true)

    // Append again. Count-based order would reuse 2 and collide with the surviving order-2 row.
    const appended = await addItemAction(appendAt(sectionId))
    expect(appended.success).toBe(true)

    const orders = await sectionItemOrders(sectionId)
    expect(orders).toHaveLength(3)
    expect(new Set(orders).size).toBe(orders.length)
    if (appended.success) expect(appended.data.item.displayOrder).toBe(Math.max(...orders))
  })
})
