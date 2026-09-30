import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { sql } from '@payloadcms/db-vercel-postgres'

// Stage actions carry their invariants in the server action, so we run the REAL action against
// the REAL DB and assert PERSISTED STATE — the delete guard is only real if the row survives, and
// the upsert is only correct if a re-entry mutates the same row instead of duplicating it.
//
// Same mock surface as the sibling delete-guard spec: requireAuth needs a request/cookie we lack
// in node, and cache revalidation touches next/cache outside a request context.
vi.mock('server-only', () => ({}))
// A real user id (looked up in beforeAll), not a hardcoded 1: removeStageAction now takes a
// pre-delete snapshot whose taken_by FKs users.id, and a fresh prod-dump test DB has no user 1.
const authState = vi.hoisted(() => ({ userId: 0, otherUserId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { removeStageAction, setStageProgressAction, updateStageAction, updateStageSplitAction } =
  await import('@/lib/actions/kosztorys')

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
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    investmentId = await createTestInvestment(payload, `kosztorys-stages-test-${Date.now()}`)
    const users = await payload.find({
      collection: 'users',
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the pre-delete snapshot to')
    authState.userId = Number(firstUser.id)
    authState.otherUserId = Number(users.docs[1]?.id ?? firstUser.id)
  })

  afterAll(async () => {
    await deleteTestInvestment(payload, investmentId)
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
        discountValue: 0,
        clientPrice: 0,
      },
      overrideAccess: true,
      ...ctx,
    })
    return Number(item.id)
  }

  async function createStage(plane: 'w_tools' | 'own_tools' | null = null): Promise<number> {
    const stage = await payload.create({
      collection: 'kosztorys-stages',
      // Distinct high ordinal base from the sibling delete-guard spec (9000+): both run in parallel
      // against the same investment, and (investment_id, ordinal) is UNIQUE — overlapping bases collide.
      data: {
        splitMode: 'percent',
        investment: investmentId,
        ordinal: 90000 + createdStages.length,
        plane,
      },
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

  async function progressRows(itemId: number, stageId: number) {
    const res = await db.execute(
      sql`SELECT id, qty_done FROM stage_progress WHERE item_id = ${itemId} AND stage_id = ${stageId}`,
    )
    return res.rows as Array<{ id: number; qty_done: string }>
  }

  describe('removeStageAction — delete guard', () => {
    // EX-477: a populated stage is no longer blocked — the StageHeader gates it behind a confirm
    // dialog; the action snapshots first, then deletes the column (cascading its progress rows).
    it('deletes a stage with recorded progress (qty_done <> 0) and snapshots first', async () => {
      const sectionId = await createSection()
      const itemId = await createItem(sectionId)
      const stageId = await createStage()
      await db.execute(sql`
        INSERT INTO stage_progress (item_id, stage_id, qty_done, created_at, updated_at)
        VALUES (${itemId}, ${stageId}, 4, now(), now())
      `)
      const before = await latestAutoSnapshotId()

      const res = await removeStageAction(stageId)

      expect(res.success).toBe(true)
      expect(await stageExists(stageId)).toBe(false)
      expect(await latestAutoSnapshotId()).toBeGreaterThan(before)
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

  describe('updateStageSplitAction — the workers of an etap (EX-943)', () => {
    // Assert the ROWS, not the action's result: a silently dropped member still returns success.
    async function splitOf(stageId: number) {
      const mode = await db.execute(
        sql`SELECT split_mode FROM kosztorys_stages WHERE id = ${stageId}`,
      )
      const members = await db.execute(sql`
        SELECT worker_id, value, takes_rest FROM kosztorys_stage_workers
        WHERE stage_id = ${stageId} ORDER BY id
      `)
      return {
        mode: (mode.rows[0] as { split_mode: string }).split_mode,
        members: members.rows.map((row) => [
          Number(row.worker_id),
          Number(row.value),
          row.takes_rest === true,
        ]),
      }
    }

    it('writes the mode and the members together, and clears them back', async () => {
      const stageId = await createStage('w_tools')
      const split = {
        mode: 'percent' as const,
        members: [
          { workerId: authState.userId, value: 0, takesRest: true },
          { workerId: authState.otherUserId, value: 25, takesRest: false },
        ],
      }

      expect((await updateStageSplitAction(stageId, split)).success).toBe(true)
      expect(await splitOf(stageId)).toEqual({
        mode: 'percent',
        members: [
          [authState.userId, 0, true],
          [authState.otherUserId, 25, false],
        ],
      })

      expect((await updateStageSplitAction(stageId, null)).success).toBe(true)
      expect((await splitOf(stageId)).members).toEqual([])
    })

    it('refuses workers on an etap with no rozliczenie, writing nothing', async () => {
      const stageId = await createStage(null)
      const res = await updateStageSplitAction(stageId, {
        mode: 'percent',
        members: [{ workerId: authState.userId, value: 0, takesRest: true }],
      })

      expect(res.success).toBe(false)
      expect((await splitOf(stageId)).members).toEqual([])
    })

    it('refuses a fixed amount above the executed work, writing nothing', async () => {
      // No stage progress → the pool is 0 zł, so any amount above zero is over it.
      const stageId = await createStage('w_tools')
      const res = await updateStageSplitAction(stageId, {
        mode: 'amount',
        members: [
          { workerId: authState.userId, value: 0, takesRest: true },
          { workerId: authState.otherUserId, value: 100, takesRest: false },
        ],
      })

      expect(res.success).toBe(false)
      expect(await splitOf(stageId)).toEqual({ mode: 'percent', members: [] })
    })

    it('leaves the workers alone when a label is renamed', async () => {
      const stageId = await createStage('w_tools')
      await updateStageSplitAction(stageId, {
        mode: 'percent',
        members: [{ workerId: authState.userId, value: 0, takesRest: true }],
      })

      expect((await updateStageAction(stageId, { label: 'przemianowany' })).success).toBe(true)
      expect((await splitOf(stageId)).members).toEqual([[authState.userId, 0, true]])
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
