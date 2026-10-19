import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { sql } from '@payloadcms/db-postgres'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { removeItemAction } = await import('@/lib/actions/kosztorys-items')
const { removeSectionAction } = await import('@/lib/actions/kosztorys-sections')

describe.skipIf(!ENV_READY)('kosztorys delete guards — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const createdSections: number[] = []
  const createdStages: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    investmentId = await createTestInvestment(payload, `delete-guard-test-${Date.now()}`)
    authState.userId = await firstUserId(payload)
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

  async function createItem(
    item: { plannedQty?: number; clientPrice?: number } = {},
  ): Promise<{ sectionId: number; itemId: number }> {
    const { sectionIds, itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'guard-test', items: [item] }],
    })
    createdSections.push(...sectionIds)
    return { sectionId: sectionIds[0], itemId: itemIds[0] }
  }

  async function createStage(): Promise<number> {
    const { stageIds } = await createKosztorysTree(payload, investmentId, {
      sections: [],
      stages: [{ ordinal: 9000 + createdStages.length }],
    })
    createdStages.push(...stageIds)
    return stageIds[0]
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

  it('(b) deletes an item with recorded stage progress (qty_done <> 0) and snapshots first', async () => {
    const { itemId } = await createItem() // pomiar 0
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

  it('(c2) captures a pre-delete auto snapshot when deleting a plan-only item', async () => {
    const { itemId } = await createItem({ plannedQty: 10, clientPrice: 99 })
    const before = await latestAutoSnapshotId()

    const res = await removeItemAction(itemId)

    expect(res.success).toBe(true)
    expect(await itemExists(itemId)).toBe(false)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
  })

  it('(d) deletes a section holding an item with stage progress and snapshots first', async () => {
    const { sectionId, itemId } = await createItem()
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
})
