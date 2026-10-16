import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { sql } from '@payloadcms/db-postgres'

vi.mock('server-only', () => ({}))
// A real user id (looked up in beforeAll), not a hardcoded 1: removeSectionAction takes a
// pre-delete snapshot whose taken_by FKs users.id, and a fresh prod-dump test DB has no user 1.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { removeItemAction, removeSectionAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys delete guards — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const createdSections: number[] = []
  const createdStages: number[] = []
  // Spread (not inlined) so payload's create overload doesn't mis-resolve to the draft branch.
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    investmentId = await createTestInvestment(payload, `delete-guard-test-${Date.now()}`)
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

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
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
      },
      overrideAccess: true,
      ...ctx,
    })
    createdSections.push(Number(section.id))
    return Number(section.id)
  }

  async function createItem(
    sectionId: number,
    data: { plannedQty?: number; clientPrice?: number } = {},
  ): Promise<number> {
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        plannedQty: data.plannedQty ?? 0,
        discountValue: 0,
        clientPrice: data.clientPrice ?? 0,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(item.id)
  }

  async function createStage(): Promise<number> {
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: {
        splitMode: 'percent',
        investment: investmentId,
        ordinal: 9000 + createdStages.length,
      },
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

  // Newest auto-snapshot id, or 0 if none. A capture is proven by this rising — a total count is
  // the fragile assertion, because the daily retention sweep is global and can thin this
  // investment's rows between two counts even though a fresh snapshot was written.
  async function latestAutoSnapshotId(): Promise<number> {
    const res = await db.execute(sql`
      SELECT coalesce(max(id), 0)::int AS id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'auto'
    `)
    return Number(res.rows[0].id)
  }

  it('(a) deletes an item with no stage progress', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId, { plannedQty: 5 })

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
  })

  it('(b) deletes an item with recorded stage progress (qty_done <> 0) and snapshots first', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId) // pomiar 0
    const stageId = await createStage()
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      VALUES (${itemId}, ${stageId}, 3, now(), now())
    `)
    const before = await latestAutoSnapshotId()

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
  })

  it('(c) deletes a plan-only item (przedmiar + price, no pomiar / progress)', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId, { plannedQty: 10, clientPrice: 99 })

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
  })

  it('(c2) captures a pre-delete auto snapshot when deleting a plan-only item', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId, { plannedQty: 10, clientPrice: 99 })
    const before = await latestAutoSnapshotId()

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
  })

  it('(d) deletes a section holding an item with stage progress and snapshots first', async () => {
    const sectionId = await createSection()
    const itemId = await createItem(sectionId)
    const stageId = await createStage()
    await db.execute(sql`
      INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
      VALUES (${itemId}, ${stageId}, 7, now(), now())
    `)
    const before = await latestAutoSnapshotId()

    const res = await removeSectionAction(sectionId)

    expect(res.success).toBe(true)
    expect(await sectionExists(sectionId)).toBe(false)
    expect(await itemExists(itemId)).toBe(false)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
  })

  it('(e) deletes an empty / plan-only section', async () => {
    const sectionId = await createSection()
    await createItem(sectionId, { plannedQty: 4, clientPrice: 50 }) // plan-only

    const res = await removeSectionAction(sectionId)

    expect(res.success).toBe(true)
    expect(await sectionExists(sectionId)).toBe(false)
  })
})
