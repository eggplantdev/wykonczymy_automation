import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// The display_order mechanics sections and items now share (EX-578), driven against the REAL DB and
// asserting PERSISTED order, not an action's return value — a success result can hide a failed write.
// The pair diverged before precisely because each side had its own copy, so both scopes run the same
// assertions here:
//   DO1 — insert-at opens the slot: the tail shifts down one and the new row lands AT the index,
//         leaving a gap-free, collision-free sequence.
//   DO2 — the ▲▼ swap exchanges exactly two rows and leaves every display_order distinct (there is
//         no unique constraint, so a half-applied swap would silently collide).
//   DO3 — a swap burst racing an insert over the same rows never aborts a transaction.
//   DO4 — a section never survives a failed first item.
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
  insertItemAction,
  insertSectionAction,
  removeItemAction,
  removeSectionAction,
  renumberKosztorysOrderAction,
  swapItemOrderAction,
  swapSectionOrderAction,
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

      // addSectionAction already seeded item @0 — two more give 0,1,2.
      await addItemAction(sectionId)
      await addItemAction(sectionId)
      const before = await itemIdsInOrder(sectionId)
      expect(await itemOrders(sectionId)).toEqual([0, 1, 2])

      const inserted = await insertItemAction(before[0], 'below')
      expect(inserted.success).toBe(true)
      if (!inserted.success) return

      // The old 1,2 became 2,3 and the new row took 1 — no gap, no collision.
      expect(await itemOrders(sectionId)).toEqual([0, 1, 2, 3])
      expect(await itemOrderById(inserted.data.id)).toBe(1)
      // The tail keeps its RELATIVE order — a shift that renumbered 1,2 as 3,2 would still read
      // [0,1,2,3] above.
      expect(await itemIdsInOrder(sectionId)).toEqual([
        before[0],
        inserted.data.id,
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
      // A section is never created alone — a 0-item section renders as 0 rows.
      expect(await itemOrders(added.data.section.id)).toEqual([0])
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
      // A section is never created alone — a 0-item section renders as 0 rows.
      expect(await itemOrders(inserted.data.section.id)).toEqual([0])
    })
  })

  // A section whose first item failed to create would survive as a 0-item section, and a 0-item
  // section emits zero rows — so it is invisible in the grid while still occupying a display_order
  // slot, unreachable and undeletable. The pair must roll back together on every path that mints a
  // section.
  describe('a section never survives a failed first item (DO4)', () => {
    it('rolls the section back when its first item fails', async () => {
      const investmentId = await freshInvestment()
      const create = payload.create.bind(payload)
      const spy = vi
        .spyOn(payload, 'create')
        .mockImplementation(async (args: Parameters<typeof create>[0]) => {
          if (args.collection === 'kosztorys-items') throw new Error('item create blew up')
          return create(args)
        })
      try {
        const res = await addSectionAction(investmentId)
        expect(res.success).toBe(false)
      } finally {
        spy.mockRestore()
      }
      expect(await sectionOrders(investmentId)).toEqual([])
    })
  })

  describe('swap exchanges exactly two rows (DO2)', () => {
    it('swapping two items leaves every display_order distinct', async () => {
      const investmentId = await freshInvestment()
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id
      const second = await addItemAction(sectionId)
      const third = await addItemAction(sectionId)
      expect([second.success, third.success]).toEqual([true, true])
      if (!second.success || !third.success) return

      const swapped = await swapItemOrderAction(second.data.id, 'down')
      expect(swapped.success).toBe(true)

      expect(await itemOrderById(second.data.id)).toBe(2)
      expect(await itemOrderById(third.data.id)).toBe(1)
      const orders = await itemOrders(sectionId)
      expect(new Set(orders).size).toBe(orders.length)
    })

    // The item twin of the section case: „w górę" is the greatest order strictly below, not
    // `display_order − 1`, so a delete's gap must not strand the row.
    it('resolves an item neighbour across a gap left by a delete', async () => {
      const investmentId = await freshInvestment()
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id
      const middle = await addItemAction(sectionId)
      const last = await addItemAction(sectionId)
      expect([middle.success, last.success]).toEqual([true, true])
      if (!middle.success || !last.success) return
      const [first] = await itemIdsInOrder(sectionId)

      await removeItemAction(middle.data.id)
      expect(await itemOrders(sectionId)).toEqual([0, 2])

      const swapped = await swapItemOrderAction(last.data.id, 'up')
      expect(swapped.success).toBe(true)

      expect(await itemIdsInOrder(sectionId)).toEqual([last.data.id, first])
    })

    it('is a successful no-op at either end of a section', async () => {
      const investmentId = await freshInvestment()
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id
      const second = await addItemAction(sectionId)
      expect(second.success).toBe(true)
      if (!second.success) return
      const before = await itemIdsInOrder(sectionId)

      const up = await swapItemOrderAction(before[0], 'up')
      const down = await swapItemOrderAction(before[1], 'down')
      expect([up.success, down.success]).toEqual([true, true])

      expect(await itemIdsInOrder(sectionId)).toEqual(before)
    })

    // A section's LAST item is not the sheet's last row — resolving the neighbour without scoping to
    // the owner would hand it a row from the next section and move a pozycja across sections.
    it('never crosses into a neighbouring section', async () => {
      const investmentId = await freshInvestment()
      const first = await addSectionAction(investmentId)
      const second = await addSectionAction(investmentId)
      expect([first.success, second.success]).toEqual([true, true])
      if (!first.success || !second.success) return
      const [firstSectionItem] = await itemIdsInOrder(first.data.section.id)
      const secondSectionBefore = await itemIdsInOrder(second.data.section.id)

      const swapped = await swapItemOrderAction(firstSectionItem, 'down')
      expect(swapped.success).toBe(true)

      expect(await itemIdsInOrder(first.data.section.id)).toEqual([firstSectionItem])
      expect(await itemIdsInOrder(second.data.section.id)).toEqual(secondSectionBefore)
    })

    it('swapping two sections leaves every display_order distinct', async () => {
      const investmentId = await freshInvestment()
      const [top, bottom] = await sectionsInDisplayOrder(investmentId, 2)

      const swapped = await swapSectionOrderAction(top, 'down')
      expect(swapped.success).toBe(true)

      expect(await sectionOrderById(top)).toBe(1)
      expect(await sectionOrderById(bottom)).toBe(0)
      const orders = await sectionOrders(investmentId)
      expect(new Set(orders).size).toBe(orders.length)
    })

    // The client sends a direction, so the neighbour is whatever the DB currently says it is —
    // including after a gap-leaving delete, where „w górę" is NOT `display_order − 1`.
    it('resolves the neighbour across a gap left by a delete', async () => {
      const investmentId = await freshInvestment()
      const [top, middle, bottom] = await sectionsInDisplayOrder(investmentId, 3)

      await removeSectionAction(middle)
      expect(await sectionOrders(investmentId)).toEqual([0, 2])

      const swapped = await swapSectionOrderAction(bottom, 'up')
      expect(swapped.success).toBe(true)

      expect(await sectionOrderById(bottom)).toBe(0)
      expect(await sectionOrderById(top)).toBe(2)
    })

    // Moving the top section up is not an error — the arrow is disabled in the UI, and a race that
    // removed the neighbour meanwhile must not surface as a failed write.
    it('is a successful no-op at either edge', async () => {
      const investmentId = await freshInvestment()
      const [top, bottom] = await sectionsInDisplayOrder(investmentId, 2)

      const up = await swapSectionOrderAction(top, 'up')
      const down = await swapSectionOrderAction(bottom, 'down')
      expect([up.success, down.success]).toEqual([true, true])

      expect(await sectionOrderById(top)).toBe(0)
      expect(await sectionOrderById(bottom)).toBe(1)
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

  // ▲▼ fires WITHOUT await (use-kosztorys-editor.ts), so a user reordering and inserting in quick
  // succession has both in flight over the same section. The swap and the insert's tail shift touch
  // an overlapping row set; if they acquire those row locks in different orders, Postgres aborts one
  // with 40P01 — and because ▲▼ is void-called with no error handling, the loser fails SILENTLY and
  // the grid keeps an order the DB never stored.
  describe('concurrent reorder + insert do not deadlock (DO3)', () => {
    it('a burst of swaps racing an insert on one section all succeed', async () => {
      const investmentId = await freshInvestment()
      const section = await addSectionAction(investmentId)
      expect(section.success).toBe(true)
      if (!section.success) return
      const sectionId = section.data.section.id

      // Ids ascending but display_order descending after the swaps below — the shift's scan order
      // and the swap's id order then disagree, which is the arrangement that deadlocks.
      const created = [await addItemAction(sectionId), await addItemAction(sectionId)]
      expect(created.map((r) => r.success)).toEqual([true, true])
      const [a, b] = created
      if (!a.success || !b.success) return

      // Each round swaps the pair back and forth while an insert shifts the same rows' tail. Only
      // SUCCESS is asserted: which rows end up where is legitimately racy under this interleaving
      // (an insert can land between a swap's neighbour read and its write), so distinctness is not a
      // property it guarantees. A deadlock is — it aborts a transaction outright.
      const racing = Array.from({ length: 12 }, (_, index) => index).flatMap((round) => [
        swapItemOrderAction(a.data.id, round % 2 === 0 ? 'down' : 'up'),
        insertItemAction(b.data.id, 'above'),
      ])
      const results = await Promise.all(racing)

      // A deadlock surfaces as a failed result, not a rejection — protectedAction catches it.
      expect(results.filter((r) => !r.success)).toEqual([])
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

      // Each addSectionAction seeds one item; one more each gives two per section.
      await addItemAction(sectionA)
      await addItemAction(sectionB)
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

      await addItemAction(sectionId)
      const [i0, i1] = await itemIdsInOrder(sectionId)
      const doomed = await addItemAction(sectionId)
      expect(doomed.success).toBe(true)
      if (!doomed.success) return
      await removeItemAction(doomed.data.id)

      // The reversal is valid on its own; the deleted third id is what must sink it. If the guard
      // and the bake were two statements, the first two rows would already be renumbered here.
      const baked = await renumberKosztorysOrderAction(investmentId, [i1, i0, doomed.data.id])
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

      const [theirItem] = await itemIdsInOrder(theirSection.data.section.id)
      const baked = await renumberKosztorysOrderAction(mine, [theirItem])
      expect(baked.success).toBe(false)
    })
  })
})
