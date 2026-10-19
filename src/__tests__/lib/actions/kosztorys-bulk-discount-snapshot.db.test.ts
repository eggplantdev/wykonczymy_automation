import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { sql } from '@payloadcms/db-postgres'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { applyPercentDiscountToAllItemsAction } = await import('@/lib/actions/kosztorys-items')

describe.skipIf(!ENV_READY)('bulk percent rabat — snapshot-before-overwrite (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const createdSections: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    investmentId = await createTestInvestment(payload, `bulk-discount-test-${Date.now()}`)
    authState.userId = await firstUserId(payload)
  })

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
  })

  afterEach(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  async function createItemWithDiscount(): Promise<number> {
    const { sectionIds, itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'rabat-test',
          items: [{ plannedQty: 10, clientPrice: 100, discountType: 'amount', discountValue: 50 }],
        },
      ],
    })
    createdSections.push(...sectionIds)
    return itemIds[0]
  }

  // Newest auto-snapshot id, or 0 — a capture is proven by this rising (the global retention sweep
  // can move the total count under us).
  async function latestAutoSnapshotId(): Promise<number> {
    const res = await db.execute(sql`
      SELECT coalesce(max(id), 0)::int AS id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'auto'
    `)
    return Number(res.rows[0].id)
  }

  async function itemDiscount(id: number): Promise<{ type: string | null; value: number }> {
    const res = await db.execute(sql`
      SELECT discount_type AS type, discount_value AS value FROM kosztorys_items WHERE id = ${id}
    `)
    return { type: res.rows[0].type as string | null, value: Number(res.rows[0].value) }
  }

  it('captures a pre-overwrite auto snapshot and stamps percent X on the items', async () => {
    const itemId = await createItemWithDiscount()
    const before = await latestAutoSnapshotId()

    const res = await applyPercentDiscountToAllItemsAction(investmentId, 15)

    expect(res.success).toBe(true)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
    expect(await itemDiscount(itemId)).toEqual({ type: 'percent', value: 15 })
  })
})
