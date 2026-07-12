import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sql } from '@payloadcms/db-vercel-postgres'

// Stage actions carry their invariants in the server action, so we run the REAL action against
// the REAL DB and assert PERSISTED STATE — the delete guard is only real if the row survives, and
// the upsert is only correct if a re-entry mutates the same row instead of duplicating it.
//
// Same mock surface as the sibling delete-guard spec: requireAuth needs a request/cookie we lack
// in node, and cache revalidation touches next/cache outside a request context.
vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))
// A real user id (looked up in beforeAll), not a hardcoded 1: removeStageAction now takes a
// pre-delete snapshot whose taken_by FKs users.id, and a fresh prod-dump test DB has no user 1.
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn() }))

const { removeStageAction, setStageProgressAction } = await import('@/lib/actions/kosztorys')

// Gated like the sibling guard spec: skips with no DB env (portable), FAILS if env is set but the
// DB is unreachable. Run against the local DB with `--env-file=.env`.
const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('kosztorys stage actions — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  // Cleaned up after each test; stage deletion cascades its own stage_progress rows, section its items.
  const createdSections: number[] = []
  const createdStages: number[] = []
  // Spread (not inlined) so payload's create overload doesn't mis-resolve to the draft branch.
  const ctx = { context: { skipRevalidation: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    // sort by id (oldest, a prod-dump investment) — parallel S-06 specs create+delete transient
    // investments with the highest ids, so an unsorted limit:1 can borrow one that vanishes mid-test.
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
    if (!firstUser) throw new Error('no user in the DB to attribute the pre-delete snapshot to')
    authState.userId = Number(firstUser.id)
  })

  afterEach(async () => {
    for (const id of createdStages.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_stages WHERE id = ${id}`)
    }
    for (const id of createdSections.splice(0)) {
      await db.execute(sql`DELETE FROM kosztorys_sections WHERE id = ${id}`)
    }
  })

  async function createSection(): Promise<number> {
    const section = await payload.create({
      collection: 'kosztorys-sections',
      data: {
        investment: investmentId,
        name: 'stage-test',
        displayOrder: 0,
        defaultCostVariant: 'w_tools',
      },
      overrideAccess: true,
      ...ctx,
    })
    createdSections.push(Number(section.id))
    return Number(section.id)
  }

  async function createItem(sectionId: number): Promise<number> {
    const item = await payload.create({
      collection: 'kosztorys-items',
      data: {
        investment: investmentId,
        section: sectionId,
        displayOrder: 0,
        plannedQty: 0,
        measuredQty: 0,
        discountValue: 0,
        clientPrice: 0,
        hiddenInExport: false,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(item.id)
  }

  async function createStage(): Promise<number> {
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      // Distinct high ordinal base from the sibling delete-guard spec (9000+): both run in parallel
      // against the same investment, and (investment_id, ordinal) is UNIQUE — overlapping bases collide.
      data: { investment: investmentId, ordinal: 90000 + createdStages.length },
      overrideAccess: true,
      ...ctx,
    })
    createdStages.push(Number(stage.id))
    return Number(stage.id)
  }

  async function stageExists(id: number): Promise<boolean> {
    const res = await db.execute(sql`SELECT 1 FROM kosztorys_stages WHERE id = ${id} LIMIT 1`)
    return res.rows.length > 0
  }

  async function progressRows(itemId: number, stageId: number) {
    const res = await db.execute(
      sql`SELECT id, qty_done FROM stage_progress WHERE item_id = ${itemId} AND stage_id = ${stageId}`,
    )
    return res.rows as Array<{ id: number; qty_done: string }>
  }

  describe('removeStageAction — delete guard', () => {
    it('blocks a stage with recorded progress (qty_done <> 0) — stage survives, exact toast error', async () => {
      const sectionId = await createSection()
      const itemId = await createItem(sectionId)
      const stageId = await createStage()
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${itemId}, ${stageId}, 4, now(), now())
      `)

      const res = await removeStageAction(stageId)

      expect(res.success).toBe(false)
      expect(res.success === false && res.error).toBe(
        'Najpierw wyczyść ilości wpisane w tym etapie',
      )
      expect(await stageExists(stageId)).toBe(true)
    })

    it('deletes a stage whose progress is all cleared to 0 (qty_done = 0 does not block)', async () => {
      const sectionId = await createSection()
      const itemId = await createItem(sectionId)
      const stageId = await createStage()
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${itemId}, ${stageId}, 0, now(), now())
      `)

      const res = await removeStageAction(stageId)

      expect(res.success).toBe(true)
      expect(await stageExists(stageId)).toBe(false)
    })

    it('deletes a stage with no progress rows at all', async () => {
      const stageId = await createStage()

      const res = await removeStageAction(stageId)

      expect(res.success).toBe(true)
      expect(await stageExists(stageId)).toBe(false)
    })
  })

  describe('setStageProgressAction — upsert by (item, stage)', () => {
    it('re-entry updates the same row in place, no duplicate (ON CONFLICT)', async () => {
      const sectionId = await createSection()
      const itemId = await createItem(sectionId)
      const stageId = await createStage()

      const first = await setStageProgressAction(itemId, stageId, 2)
      expect(first.success).toBe(true)
      const afterInsert = await progressRows(itemId, stageId)
      expect(afterInsert).toHaveLength(1)
      expect(Number(afterInsert[0].qty_done)).toBe(2)

      const second = await setStageProgressAction(itemId, stageId, 5)
      expect(second.success).toBe(true)
      const afterUpdate = await progressRows(itemId, stageId)
      expect(afterUpdate).toHaveLength(1) // no duplicate row
      expect(afterUpdate[0].id).toBe(afterInsert[0].id) // same row mutated in place
      expect(Number(afterUpdate[0].qty_done)).toBe(5)
    })
  })
})
