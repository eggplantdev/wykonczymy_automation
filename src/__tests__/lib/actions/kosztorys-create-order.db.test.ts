import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { appendAt } from '@/__tests__/helpers/new-item-input'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { addItemAction, removeItemAction } = await import('@/lib/actions/kosztorys-items')

describe.skipIf(!ENV_READY)('kosztorys create-order integrity (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let sharedInvestmentId: number
  const createdSections: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    sharedInvestmentId = await createTestInvestment(payload, `create-order-test-${Date.now()}`)
    authState.userId = await firstUserId(payload)
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
    const {
      sectionIds: [sectionId],
    } = await createKosztorysTree(payload, sharedInvestmentId, {
      sections: [{ name: 'order-test' }],
    })
    createdSections.push(sectionId)
    return sectionId
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
