import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'
import { appendAt, insertNextTo } from '@/__tests__/helpers/new-item-input'

// The display_order mechanics sections and items now share (EX-578), driven against the REAL DB and
// asserting PERSISTED order, not an action's return value — a success result can hide a failed write.
// The pair diverged before precisely because each side had its own copy, so both scopes run the same
// assertions here:
//   DO1 — insert-at opens the slot: the tail shifts down one and the new row lands AT the index,
//         leaving a gap-free, collision-free sequence.
//   DO4 — a new section is created bare: no pozycja is seeded into it.
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
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const {
  addItemAction,
  addSectionAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  renumberKosztorysOrderAction,
} = await import('@/lib/actions/kosztorys')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FIXTURE_PREFIX = 'display-order-test-'

describe.skipIf(!ENV_READY)('kosztorys display_order mechanics (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  const createdInvestments: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
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

  // A crashed run leaves its investments behind, and financial-golden-master-db.test.ts enumerates
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

  // Ids ordered by display_order — the shape that distinguishes a correct shift from a tail that
  // renumbered to the same [0,1,2,3] in the wrong ORDER.
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

  describe('insert-at opens the slot (DO1)', () => {
    it('inserting an item mid-section shifts the tail and lands at the index', async () => {
      const investmentId = await freshInvestment()
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id

      await addItemAction(appendAt(sectionId))
      await addItemAction(appendAt(sectionId))
      await addItemAction(appendAt(sectionId))
      const before = await itemIdsInOrder(sectionId)
      expect(await itemOrders(sectionId)).toEqual([0, 1, 2])

      const inserted = await addItemAction(insertNextTo(before[0], 'below'))
      expect(inserted.success).toBe(true)
      if (!inserted.success) return

      // The old 1,2 became 2,3 and the new row took 1 — no gap, no collision.
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

      // Anchor + direction, not an index: „poniżej" the first section IS slot 1, and the server is
      // the only party that knows that.
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
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id
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

  // „Zapisz kolejność" sends an id SEQUENCE for the whole sheet and the server derives the numbers.
  // Both halves are asserted against the persisted rows: a success result would still be returned by
  // a bake whose UPDATE matched nothing.
  describe('the bake numbers per section, all-or-nothing (DO5)', () => {
    it('restarts at 0 in each section, following the sequence sent', async () => {
      const investmentId = await freshInvestment()
      const first = await addSectionAction(investmentId)
      const second = await addSectionAction(investmentId)
      expect([first.success, second.success]).toEqual([true, true])
      if (!first.success || !second.success) return
      const [sectionA, sectionB] = [first.data.section.id, second.data.section.id]

      for (const sectionId of [sectionA, sectionA, sectionB, sectionB])
        await addItemAction(appendAt(sectionId))
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
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id

      await addItemAction(appendAt(sectionId))
      await addItemAction(appendAt(sectionId))
      const [i0, i1] = await itemIdsInOrder(sectionId)
      const doomed = await addItemAction(appendAt(sectionId))
      expect(doomed.success).toBe(true)
      if (!doomed.success) return
      await removeItemAction(doomed.data.item.id)

      // The reversal is valid on its own; the deleted third id is what must sink it. If the guard
      // and the bake were two statements, the first two rows would already be renumbered here.
      const baked = await renumberKosztorysOrderAction(investmentId, [i1, i0, doomed.data.item.id])
      expect(baked.success).toBe(false)
      expect(await itemIdsInOrder(sectionId)).toEqual([i0, i1])
    })

    it('refuses ids belonging to another investment', async () => {
      const mine = await freshInvestment()
      const theirs = await freshInvestment()
      const mySection = await addSectionAction(mine)
      const theirSection = await addSectionAction(theirs)
      expect([mySection.success, theirSection.success]).toEqual([true, true])
      if (!mySection.success || !theirSection.success) return
      await addItemAction(appendAt(theirSection.data.section.id))

      const [theirItem] = await itemIdsInOrder(theirSection.data.section.id)
      const baked = await renumberKosztorysOrderAction(mine, [theirItem])
      expect(baked.success).toBe(false)
    })
  })
})
