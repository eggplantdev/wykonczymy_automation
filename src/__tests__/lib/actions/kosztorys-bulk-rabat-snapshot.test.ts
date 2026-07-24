import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sql } from '@payloadcms/db-vercel-postgres'

// applyPercentRabatToAllItemsAction flattens EVERY item's per-item rabat to `percent X` in one
// irreversible UPDATE. Like removeSectionAction, it must capture a pre-overwrite auto snapshot first
// so the hand-tuned rabaty it overwrites stay recoverable. We run the REAL action against the REAL DB
// and assert PERSISTED STATE — the snapshot rose AND the rows were overwritten — not the return value.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { applyPercentRabatToAllItemsAction } = await import('@/lib/actions/kosztorys')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('bulk percent rabat — snapshot-before-overwrite (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  const createdSections: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    const inv = await payload.find({
      collection: 'investments',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const first = inv.docs[0]
    if (!first) throw new Error('no investment in the DB to attach test fixtures to')
    investmentId = Number(first.id)
    const users = await payload.find({
      collection: 'users',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the snapshot to')
    authState.userId = Number(firstUser.id)
  })

  afterEach(async () => {
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  const ctx = { context: { skipRevalidation: true } }

  async function createItemWithRabat(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'rabat-test',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      overrideAccess: true,
      ...ctx,
    })
    createdSections.push(Number(section.id))
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: Number(section.id),
        displayOrder: 0,
        plannedQty: 10,
        clientPrice: 100,
        discountType: 'amount',
        discountValue: 50,
        hiddenInExport: false,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(item.id)
  }

  // Newest auto-snapshot id, or 0 — a capture is proven by this rising (pruneAutoCount can hold the
  // total count flat), matching the delete-guard suite's convention.
  async function latestAutoSnapshotId(): Promise<number> {
    const res = await db.execute(sql`
      SELECT coalesce(max(id), 0)::int AS id FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'auto'
    `)
    return Number(res.rows[0].id)
  }

  async function itemRabat(id: number): Promise<{ type: string | null; value: number }> {
    const res = await db.execute(sql`
      SELECT discount_type AS type, discount_value AS value FROM kosztorys_items WHERE id = ${id}
    `)
    return { type: res.rows[0].type as string | null, value: Number(res.rows[0].value) }
  }

  it('captures a pre-overwrite auto snapshot and stamps percent X on the items', async () => {
    const itemId = await createItemWithRabat()
    const before = await latestAutoSnapshotId()

    const res = await applyPercentRabatToAllItemsAction(investmentId, 15)

    expect(res.success).toBe(true)
    expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
    expect(await itemRabat(itemId)).toEqual({ type: 'percent', value: 15 })
  })
})
