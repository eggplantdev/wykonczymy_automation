import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { appendAt, insertNextTo } from '@/__tests__/helpers/new-item-input'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { addItemAction, removeItemAction, renumberKosztorysOrderAction } =
  await import('@/lib/actions/kosztorys-items')
const { addSectionAction, insertSectionAction, removeSectionAction } =
  await import('@/lib/actions/kosztorys-sections')

const FIXTURE_PREFIX = 'display-order-test-'

describe.skipIf(!ENV_READY)('kosztorys display_order mechanics (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdInvestments: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    authState.userId = await firstUserId(payload)
  })

  // A crashed run leaves its investments behind, and financial-golden-master.db.test.ts enumerates
  // this same DB with `limit: 0` — a leaked fixture would show up there as unexplained drift.
  beforeAll(async () => {
    await db.execute(sql`DELETE FROM investments WHERE name LIKE ${`${FIXTURE_PREFIX}%`}`)
  })

  // A dedicated investment per test: the section-order assertions read the WHOLE investment's
  // sequence, so a fixture attached to a shared investment would see other specs' sections.
  async function freshInvestment(): Promise<number> {
    const created = await createTestInvestment(
      payload,
      `${FIXTURE_PREFIX}${createdInvestments.length}-${authState.userId}`,
    )
    createdInvestments.push(created)
    return created
  }

  afterEach(async () => {
    for (const id of createdInvestments.splice(0)) {
      await db.execute(sql`DELETE FROM investments WHERE id = ${id}`)
    }
  })

  async function sectionOrders(invId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_sections WHERE investment_id = ${invId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.display_order))
  }

  async function itemOrders(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.display_order))
  }

  async function itemIdsInOrder(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.id))
  }

  async function sectionIdsInOrder(invId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_sections WHERE investment_id = ${invId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.id))
  }

  async function itemOrderById(itemId: number): Promise<number> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_items WHERE id = ${itemId}`,
    )
    return Number(res.rows[0].display_order)
  }

  async function sectionOrderById(sectionId: number): Promise<number> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_sections WHERE id = ${sectionId}`,
    )
    return Number(res.rows[0].display_order)
  }

  // „Dodaj sekcję" PREPENDS, so creation order is the reverse of display order — these specs name
  // their sections by where they sit, not by when they were made.
  async function sectionsInDisplayOrder(invId: number, count: number): Promise<number[]> {
    const ids: number[] = []
    for (let i = 0; i < count; i++) {
      const res = await addSectionAction(invId)
      if (!res.success) throw new Error('section fixture failed')
      ids.unshift(res.data.section.id)
    }
    return ids
  }

  async function newSection(invId: number): Promise<number> {
    const [id] = await sectionsInDisplayOrder(invId, 1)
    return id
  }

  async function addItems(sectionId: number, count: number): Promise<void> {
    for (let i = 0; i < count; i++) await addItemAction(appendAt(sectionId))
  }

  describe('insert-at opens the slot (DO1)', () => {
    it('inserting an item mid-section shifts the tail and lands at the index', async () => {
      const sectionId = await newSection(await freshInvestment())
      await addItems(sectionId, 3)
      const before = await itemIdsInOrder(sectionId)
      expect(await itemOrders(sectionId)).toEqual([0, 1, 2])

      const inserted = await addItemAction(insertNextTo(before[0], 'below'))
      expect(inserted.success).toBe(true)
      if (!inserted.success) return

      expect(await itemOrders(sectionId)).toEqual([0, 1, 2, 3])
      expect(await itemOrderById(inserted.data.item.id)).toBe(1)
      // The tail keeps its RELATIVE order — a shift that renumbered 1,2 as 3,2 would still read
      // [0,1,2,3] above.
      expect(await itemIdsInOrder(sectionId)).toEqual([
        before[0],
        inserted.data.item.id,
        before[1],
        before[2],
      ])
    })

    it('adding a section lands it at the TOP and shifts the tail', async () => {
      const investmentId = await freshInvestment()
      const before = await sectionsInDisplayOrder(investmentId, 2)

      const added = await addSectionAction(investmentId)
      expect(added.success).toBe(true)
      if (!added.success) return

      expect(await sectionOrders(investmentId)).toEqual([0, 1, 2])
      expect(await sectionIdsInOrder(investmentId)).toEqual([added.data.section.id, ...before])
    })

    it('inserting a section mid-investment shifts the tail and lands at the index', async () => {
      const investmentId = await freshInvestment()
      await sectionsInDisplayOrder(investmentId, 3)
      const before = await sectionIdsInOrder(investmentId)
      expect(await sectionOrders(investmentId)).toEqual([0, 1, 2])

      const inserted = await insertSectionAction(before[0], 'below')
      expect(inserted.success).toBe(true)
      if (!inserted.success) return

      expect(await sectionOrders(investmentId)).toEqual([0, 1, 2, 3])
      expect(await sectionOrderById(inserted.data.section.id)).toBe(1)
      expect(await sectionIdsInOrder(investmentId)).toEqual([
        before[0],
        inserted.data.section.id,
        before[1],
        before[2],
      ])
    })

    it('refuses an insert against a section that no longer exists', async () => {
      const investmentId = await freshInvestment()
      const sectionId = await newSection(investmentId)
      await removeSectionAction(sectionId)

      const inserted = await insertSectionAction(sectionId, 'below')
      expect(inserted.success).toBe(false)
      expect(await sectionOrders(investmentId)).toEqual([])
    })
  })

  describe('a new section is created bare (DO4)', () => {
    it('adding or inserting a section creates no pozycja', async () => {
      const investmentId = await freshInvestment()
      const added = await addSectionAction(investmentId)
      expect(added.success).toBe(true)
      if (!added.success) return
      const inserted = await insertSectionAction(added.data.section.id, 'below')
      expect(inserted.success).toBe(true)
      if (!inserted.success) return

      expect(await itemOrders(added.data.section.id)).toEqual([])
      expect(await itemOrders(inserted.data.section.id)).toEqual([])
    })
  })

  describe('the bake numbers per section, all-or-nothing (DO5)', () => {
    it('restarts at 0 in each section, following the sequence sent', async () => {
      const investmentId = await freshInvestment()
      const [sectionA, sectionB] = await sectionsInDisplayOrder(investmentId, 2)
      await addItems(sectionA, 2)
      await addItems(sectionB, 2)
      const [a0, a1] = await itemIdsInOrder(sectionA)
      const [b0, b1] = await itemIdsInOrder(sectionB)

      // One flat sequence spanning both sections, each reversed — so a bake that numbered globally
      // would leave section B on 2,3 instead of 0,1.
      const baked = await renumberKosztorysOrderAction(investmentId, [a1, a0, b1, b0])
      expect(baked.success).toBe(true)

      expect(await itemOrders(sectionA)).toEqual([0, 1])
      expect(await itemOrders(sectionB)).toEqual([0, 1])
      expect(await itemIdsInOrder(sectionA)).toEqual([a1, a0])
      expect(await itemIdsInOrder(sectionB)).toEqual([b1, b0])
    })

    it('refuses the whole bake — writing nothing — when one id is stale', async () => {
      const investmentId = await freshInvestment()
      const sectionId = await newSection(investmentId)
      await addItems(sectionId, 2)
      const [i0, i1] = await itemIdsInOrder(sectionId)
      const doomed = await addItemAction(appendAt(sectionId))
      expect(doomed.success).toBe(true)
      if (!doomed.success) return
      await removeItemAction(doomed.data.item.id)

      // If the guard and the bake were two statements, the first two rows would already be
      // renumbered here.
      const baked = await renumberKosztorysOrderAction(investmentId, [i1, i0, doomed.data.item.id])
      expect(baked.success).toBe(false)
      expect(await itemIdsInOrder(sectionId)).toEqual([i0, i1])
    })

    it('refuses ids belonging to another investment', async () => {
      const mine = await freshInvestment()
      await newSection(mine)
      const theirSection = await newSection(await freshInvestment())
      await addItems(theirSection, 1)

      const [theirItem] = await itemIdsInOrder(theirSection)
      const baked = await renumberKosztorysOrderAction(mine, [theirItem])
      expect(baked.success).toBe(false)
    })
  })
})
