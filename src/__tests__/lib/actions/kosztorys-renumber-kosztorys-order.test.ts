import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment } from '@/__tests__/helpers/investment'

// „Zapisz kolejność" — the multi-section write, driven against the REAL DB and
// asserting the PERSISTED sequence (a success result can hide a failed write).
//   RK1 — every section takes its new order in one call, each restarting at 0. The caller sends one
//         flat id sequence for the whole sheet; splitting it per section and numbering 0…n-1 is the
//         server's job, which is the invariant no client-side numbering could be trusted with.
//   RK2 — ids from another investment are refused outright; nothing is written.
//   RK3 — a duplicate id is refused (it would make the VALUES join ambiguous).
//   RK4 — one stale id (a row deleted in another tab) refuses the ENTIRE bake: the client's rollback
//         to the previous sequence assumes all-or-nothing.
//
// Same mock surface as the sibling action specs.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { addItemAction, addSectionAction, removeItemAction, renumberKosztorysOrderAction } =
  await import('@/lib/actions/kosztorys')

// Gated like the sibling specs: skips with no DB env, FAILS if env is set but the DB is unreachable.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FIXTURE_PREFIX = 'renumber-kosztorys-order-test-'

describe.skipIf(!ENV_READY)('renumberKosztorysOrderAction (DB)', () => {
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

  async function itemIdsInOrder(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT id FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.id))
  }

  // The ids alone can't show it: any strictly increasing pair yields the same sequence, so only the
  // values prove each section restarted at 0.
  async function itemOrders(sectionId: number): Promise<number[]> {
    const res = await db.execute(
      sql`SELECT display_order FROM kosztorys_items WHERE section_id = ${sectionId} ORDER BY display_order`,
    )
    return res.rows.map((r) => Number(r.display_order))
  }

  // addSectionAction seeds item @0; `extra` more give a 1+extra-row section.
  async function sectionWithItems(investmentId: number, extra: number): Promise<number> {
    const section = await addSectionAction(investmentId)
    if (!section.success) throw new Error('section fixture failed')
    for (let i = 0; i < extra; i++) await addItemAction(section.data.section.id)
    return section.data.section.id
  }

  it('renumbers every section in one call, each restarting at 0 (RK1)', async () => {
    const investmentId = await freshInvestment()
    const first = await sectionWithItems(investmentId, 1)
    const second = await sectionWithItems(investmentId, 1)
    const [a, b] = await itemIdsInOrder(first)
    const [c, d] = await itemIdsInOrder(second)

    const res = await renumberKosztorysOrderAction(investmentId, [b, a, d, c])
    expect(res.success).toBe(true)

    expect(await itemIdsInOrder(first)).toEqual([b, a])
    expect(await itemIdsInOrder(second)).toEqual([d, c])
    expect(await itemOrders(first)).toEqual([0, 1])
    expect(await itemOrders(second)).toEqual([0, 1])
  })

  it('refuses ids belonging to another investment and writes nothing (RK2)', async () => {
    const investmentId = await freshInvestment()
    const mine = await sectionWithItems(investmentId, 1)
    const otherInvestmentId = await freshInvestment()
    const theirs = await sectionWithItems(otherInvestmentId, 1)
    const [a, b] = await itemIdsInOrder(mine)
    const [foreign] = await itemIdsInOrder(theirs)
    const theirsBefore = await itemIdsInOrder(theirs)

    const res = await renumberKosztorysOrderAction(investmentId, [b, a, foreign])
    expect(res.success).toBe(false)

    expect(await itemIdsInOrder(mine)).toEqual([a, b])
    expect(await itemIdsInOrder(theirs)).toEqual(theirsBefore)
  })

  it('refuses a duplicate id (RK3)', async () => {
    const investmentId = await freshInvestment()
    const sectionId = await sectionWithItems(investmentId, 1)
    const [a, b] = await itemIdsInOrder(sectionId)

    const res = await renumberKosztorysOrderAction(investmentId, [a, a, b])
    expect(res.success).toBe(false)

    expect(await itemIdsInOrder(sectionId)).toEqual([a, b])
  })

  it('refuses the whole bake when one id is stale (RK4)', async () => {
    const investmentId = await freshInvestment()
    const sectionId = await sectionWithItems(investmentId, 2)
    const [a, b, c] = await itemIdsInOrder(sectionId)
    await removeItemAction(c)

    const res = await renumberKosztorysOrderAction(investmentId, [b, a, c])
    expect(res.success).toBe(false)

    expect(await itemIdsInOrder(sectionId)).toEqual([a, b])
    expect(await itemOrders(sectionId)).toEqual([0, 1])
  })
})
