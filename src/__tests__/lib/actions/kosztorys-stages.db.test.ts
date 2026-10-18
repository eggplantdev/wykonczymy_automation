import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { sql } from '@payloadcms/db-postgres'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

vi.mock('@/lib/auth/get-current-user-jwt', () => import('@/__tests__/stubs/get-current-user-jwt'))

const {
  addStageAction,
  removeStageAction,
  setStageProgressAction,
  updateStageAction,
  updateStageSplitAction,
} = await import('@/lib/actions/kosztorys')
const { WORKER_TRASHED_MESSAGE } = await import('@/lib/constants/worker-lock')

describe.skipIf(!ENV_READY)('kosztorys stage actions — persisted state (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherUserId: number
  const createdSections: number[] = []
  const createdStages: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    // Self-provisioned rather than borrowed: the oldest prod-dump investments are
    // `completed`, and a completed investment refuses every kosztorys write.
    investmentId = await createTestInvestment(payload, `kosztorys-stages-test-${Date.now()}`)
    const users = await payload.find({
      collection: 'users',
      // The etap write refuses a trashed worker, and a restored dump can trash anyone.
      where: { trashedAt: { exists: false } },
      limit: 2,
      depth: 0,
      overrideAccess: true,
    })
    const firstUser = users.docs[0]
    if (!firstUser) throw new Error('no user in the DB to attribute the pre-delete snapshot to')
    // A real user id, not the stub's 1: removeStageAction takes a pre-delete snapshot whose
    // taken_by FKs users.id, and a fresh prod-dump test DB has no user 1.
    authState.userId = Number(firstUser.id)
    otherUserId = Number(users.docs[1]?.id ?? firstUser.id)
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

  async function createItem(): Promise<number> {
    const { sectionIds, itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'stage-test', items: [{}] }],
    })
    createdSections.push(...sectionIds)
    return itemIds[0]
  }

  async function createStage(plane: 'w_tools' | 'own_tools' | null = null): Promise<number> {
    const { stageIds } = await createKosztorysTree(payload, investmentId, {
      sections: [],
      // Distinct high ordinal base from the sibling delete-guard spec (9000+): both run in parallel
      // against the same investment, and (investment_id, ordinal) is UNIQUE — overlapping bases collide.
      stages: [{ ordinal: 90000 + createdStages.length, plane }],
    })
    createdStages.push(...stageIds)
    return stageIds[0]
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
    it('deletes a stage with recorded progress (qty_done <> 0) and snapshots first', async () => {
      const itemId = await createItem()
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
  })

  describe('updateStageSplitAction — the workers of an etap', () => {
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
          { workerId: otherUserId, value: 25, takesRest: false },
        ],
      }

      expect((await updateStageSplitAction(stageId, split)).success).toBe(true)
      expect(await splitOf(stageId)).toEqual({
        mode: 'percent',
        members: [
          [authState.userId, 0, true],
          [otherUserId, 25, false],
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
          { workerId: otherUserId, value: 100, takesRest: false },
        ],
      })

      expect(res.success).toBe(false)
      expect(await splitOf(stageId)).toEqual({ mode: 'percent', members: [] })
    })

    it('refuses a split nobody takes the rest of, instead of electing one', async () => {
      const stageId = await createStage('w_tools')
      const res = await updateStageSplitAction(stageId, {
        mode: 'percent',
        members: [
          { workerId: authState.userId, value: 30, takesRest: false },
          { workerId: otherUserId, value: 20, takesRest: false },
        ],
      })

      expect(res.success).toBe(false)
      expect((await splitOf(stageId)).members).toEqual([])
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

  describe('updateStageAction — etap zakończony', () => {
    async function completedOf(stageId: number): Promise<unknown> {
      const res = await db.execute(
        sql`SELECT completed FROM kosztorys_stages WHERE id = ${stageId}`,
      )
      return res.rows[0]?.completed
    }

    it('starts open, persists the flag and clears it again', async () => {
      const stageId = await createStage('w_tools')
      expect(await completedOf(stageId)).toBe(false)

      expect((await updateStageAction(stageId, { completed: true })).success).toBe(true)
      expect(await completedOf(stageId)).toBe(true)

      expect((await updateStageAction(stageId, { completed: false })).success).toBe(true)
      expect(await completedOf(stageId)).toBe(false)
    })
  })

  describe('a worker in the kosz', () => {
    async function withTrashedOther(run: () => Promise<void>) {
      await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${otherUserId}`)
      try {
        await run()
      } finally {
        await db.execute(sql`UPDATE users SET trashed_at = NULL WHERE id = ${otherUserId}`)
      }
    }

    async function membersOf(stageId: number) {
      const res = await db.execute(
        sql`SELECT worker_id FROM kosztorys_stage_workers WHERE stage_id = ${stageId}`,
      )
      return res.rows.map((row) => Number(row.worker_id))
    }

    it('refuses to put a trashed worker on an etap, writing nothing', async () => {
      const stageId = await createStage('w_tools')
      await withTrashedOther(async () => {
        const res = await updateStageSplitAction(stageId, {
          mode: 'percent',
          members: [
            { workerId: authState.userId, value: 0, takesRest: true },
            { workerId: otherUserId, value: 25, takesRest: false },
          ],
        })

        expect(res).toEqual({ success: false, error: WORKER_TRASHED_MESSAGE })
        expect(await membersOf(stageId)).toEqual([])
      })
    })

    it('refuses a new etap naming a trashed worker, creating no etap', async () => {
      const before = await db.execute(
        sql`SELECT count(*)::int AS n FROM kosztorys_stages WHERE investment_id = ${investmentId}`,
      )
      await withTrashedOther(async () => {
        const res = await addStageAction(investmentId, 'w_tools', {
          mode: 'percent',
          members: [{ workerId: otherUserId, value: 0, takesRest: true }],
        })

        expect(res).toEqual({ success: false, error: WORKER_TRASHED_MESSAGE })
      })
      const after = await db.execute(
        sql`SELECT count(*)::int AS n FROM kosztorys_stages WHERE investment_id = ${investmentId}`,
      )
      expect(after.rows[0]?.n).toBe(before.rows[0]?.n)
    })
  })

  // A worker with etapy in both rozliczenia loses his report link (`resolveWorkerScope`), so the
  // write that would mix them is refused instead — even for an etap with nothing in it yet.
  describe('one rozliczenie per worker on an investment', () => {
    const oneWorker = (workerId: number) => ({
      mode: 'percent' as const,
      members: [{ workerId, value: 0, takesRest: true }],
    })

    async function stagesOf(workerId: number) {
      const res = await db.execute(sql`
        SELECT s.id, s.plane FROM kosztorys_stages s
        JOIN kosztorys_stage_workers w ON w.stage_id = s.id
        WHERE s.investment_id = ${investmentId} AND w.worker_id = ${workerId}
        ORDER BY s.id
      `)
      return res.rows.map((row) => [Number(row.id), row.plane])
    }

    async function ownStage(plane: 'w_tools' | 'own_tools') {
      const stageId = await createStage(plane)
      expect((await updateStageSplitAction(stageId, oneWorker(authState.userId))).success).toBe(
        true,
      )
      return stageId
    }

    it('refuses a new etap putting him on the other rozliczenie, creating no etap', async () => {
      const stageId = await ownStage('w_tools')

      const res = await addStageAction(investmentId, 'own_tools', oneWorker(authState.userId))
      if (res.success) createdStages.push(res.data.id)

      expect(res.success).toBe(false)
      expect(await stagesOf(authState.userId)).toEqual([[stageId, 'w_tools']])
    })

    it('opens a new etap for him on his own rozliczenie', async () => {
      await ownStage('w_tools')

      const res = await addStageAction(investmentId, 'w_tools', oneWorker(authState.userId))
      if (res.success) createdStages.push(res.data.id)

      expect(res.success).toBe(true)
    })

    it('refuses adding him to an etap on the other rozliczenie, writing no member', async () => {
      const stageId = await ownStage('w_tools')
      const otherPlaneStageId = await createStage('own_tools')

      const res = await updateStageSplitAction(otherPlaneStageId, oneWorker(authState.userId))

      expect(res.success).toBe(false)
      expect(await stagesOf(authState.userId)).toEqual([[stageId, 'w_tools']])
    })

    it('refuses switching his etap to the other rozliczenie while another of his stays', async () => {
      const firstId = await ownStage('w_tools')
      const secondId = await ownStage('w_tools')

      const res = await updateStageAction(secondId, { plane: 'own_tools' })

      expect(res.success).toBe(false)
      expect(await stagesOf(authState.userId)).toEqual([
        [firstId, 'w_tools'],
        [secondId, 'w_tools'],
      ])
    })

    it('switches the rozliczenie of his only etap — a wrong pick stays fixable', async () => {
      const stageId = await ownStage('w_tools')

      expect((await updateStageAction(stageId, { plane: 'own_tools' })).success).toBe(true)
      expect(await stagesOf(authState.userId)).toEqual([[stageId, 'own_tools']])
    })
  })

  describe('setStageProgressAction — upsert by (item, stage)', () => {
    it('re-entry updates the same row in place, no duplicate (ON CONFLICT)', async () => {
      const itemId = await createItem()
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
