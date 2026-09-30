import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { selectKosztorysTreeData } from '@/lib/db/kosztorys-tree'
import { insertWorkerReport, readWorkerReport } from '@/lib/db/worker-reports'
import { oneWorkerSplit } from '@/lib/kosztorys/stage-split'
import type { AcceptReportInputT } from '@/lib/kosztorys/worker-report/types'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn().mockImplementation(async () => ({
    success: true,
    user: { id: authState.userId, email: 'k@t.com', name: 'Kierownik', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
// The last write of the transaction: failing it is the one way to reach „the tree, the etap and the
// version were all written, then the accept failed" without racing the action.
const recording = vi.hoisted(() => ({ failNext: false }))
vi.mock('@/lib/db/worker-reports', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/worker-reports')>()
  return {
    ...actual,
    setReportTarget: async (...args: Parameters<typeof actual.setReportTarget>) => {
      if (recording.failNext) throw new Error('record failed')
      return actual.setReportTarget(...args)
    },
  }
})

const { acceptWorkerReportAction } = await import('@/lib/actions/worker-report')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('acceptWorkerReportAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let otherWorkerId: number
  let sectionId: number
  let itemIds: number[]
  let ownStageId: number
  let otherStageId: number

  const makeUser = async (name: string, email: string) => {
    const user = await payload.create({
      collection: 'users',
      data: { name, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(user.id)
  }

  const sendReport = async (lines: { itemId: number | null; qty: number; opis?: string }[]) => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: lines.map((line) => ({
        kind: line.itemId === null ? 'extra' : 'rozpiska',
        itemId: line.itemId,
        description: line.opis ?? 'Malowanie ścian',
        unit: 'm²',
        sectionName: line.itemId === null ? null : 'Salon',
        reportedQty: line.qty,
      })),
    })
    const stored = await readWorkerReport(db, investmentId, reportId)
    return { reportId, lineIds: stored?.lines.map((line) => line.id) ?? [] }
  }

  const qtyDone = async (itemId: number, stageId: number) => {
    const res = await db.execute(sql`
      SELECT qty_done FROM stage_progress WHERE item_id = ${itemId} AND stage_id = ${stageId}
    `)
    return Number(res.rows[0]?.qty_done ?? 0)
  }

  const snapshotCount = async () => {
    const res = await db.execute(sql`
      SELECT count(*)::int AS total FROM kosztorys_snapshots WHERE investment_id = ${investmentId}
    `)
    return Number(res.rows[0]?.total)
  }

  const accept = (
    input: Omit<AcceptReportInputT, 'investmentId' | 'extras'> & Partial<AcceptReportInputT>,
  ) => acceptWorkerReportAction({ investmentId, extras: [], ...input })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)

    workerId = await makeUser('Jan Zgłaszający', 'accept-report@test.local')
    otherWorkerId = await makeUser('Piotr Inny', 'accept-report-other@test.local')
  })

  beforeEach(async () => {
    investmentId = await createTestInvestment(payload, 'EX-947 accept report spec')
    const tree = await createKosztorysTree(payload, investmentId, {
      sections: [
        {
          name: 'Salon',
          items: [
            { description: 'Malowanie ścian', unit: 'm²', plannedQty: 40 },
            { description: 'Gładzie', unit: 'm²', plannedQty: 20 },
          ],
        },
      ],
      stages: [
        { worker: workerId, plane: 'w_tools' },
        { worker: otherWorkerId, plane: 'w_tools' },
      ],
      progress: [{ item: 0, stage: 0, qtyDone: 5 }],
    })
    ;[sectionId] = tree.sectionIds
    itemIds = tree.itemIds
    ;[ownStageId, otherStageId] = tree.stageIds
  })

  afterEach(async () => {
    recording.failNext = false
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('adds the accepted ilość to the etap figure already there', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 7 }],
    })

    expect(res.success).toBe(true)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(12)
    if (res.success) {
      expect(res.data.cells).toEqual([{ itemId: itemIds[0], stageId: ownStageId, qtyDone: 12 }])
    }
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.report.status).toBe('accepted')
    expect(stored?.lines[0].acceptedQty).toBe(7)
  })

  it('sums two lines for one pozycja instead of failing', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[1], qty: 2 },
      { itemId: itemIds[1], qty: 3 },
    ])
    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: lineIds.map((lineId) => ({ lineId, acceptedQty: lineId === lineIds[0] ? 2 : 3 })),
    })

    expect(res.success).toBe(true)
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(5)
  })

  it('opens „Nowy etap" with the next number, his rozliczenie and him at 100%', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 4 }])
    const res = await accept({
      reportId,
      target: { kind: 'new' },
      lines: [{ lineId: lineIds[0], acceptedQty: 4 }],
    })

    expect(res.success).toBe(true)
    const tree = await selectKosztorysTreeData(db, investmentId)
    const created = tree?.stages.find(
      (stage) => stage.id !== ownStageId && stage.id !== otherStageId,
    )
    const maxBefore = Math.max(
      ...(tree?.stages ?? []).filter((stage) => stage !== created).map((stage) => stage.ordinal),
    )
    expect(created).toMatchObject({
      ordinal: maxBefore + 1,
      plane: 'w_tools',
      split: oneWorkerSplit(workerId),
    })
    if (res.success) expect(res.data.stage?.id).toBe(created?.id)
    expect(await qtyDone(itemIds[0], created?.id ?? 0)).toBe(4)
  })

  it('turns a praca spoza rozpiski into a pozycja bez przedmiaru at the typed cena', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: null, qty: 3, opis: 'Wniesienie płyt' },
    ])
    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [],
      extras: [{ lineId: lineIds[0], acceptedQty: 3, sectionId, clientPrice: 25 }],
    })

    expect(res.success).toBe(true)
    const tree = await selectKosztorysTreeData(db, investmentId)
    const created = tree?.items.find((item) => item.description === 'Wniesienie płyt')
    expect(created).toMatchObject({ sectionId, plannedQty: 0, clientPrice: 25, unit: 'm²' })
    expect(await qtyDone(created?.id ?? 0, ownStageId)).toBe(3)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.lines[0].createdItemId).toBe(created?.id)
  })

  it('refuses a second accept of the same report and changes nothing', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
    const input = {
      reportId,
      target: { kind: 'stage' as const, stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
    }
    expect((await accept(input)).success).toBe(true)
    const snapshotsAfterFirst = await snapshotCount()

    const second = await accept(input)
    expect(second.success).toBe(false)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(7)
    expect(await snapshotCount()).toBe(snapshotsAfterFirst)
  })

  it('refuses an etap the reporting worker is not on', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: otherStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
    })

    expect(res).toEqual({
      success: false,
      error: 'Wybrany etap nie jest etapem tego pracownika.',
    })
    expect(await qtyDone(itemIds[0], otherStageId)).toBe(0)
    expect((await readWorkerReport(db, investmentId, reportId))?.report.status).toBe('pending')
  })

  it('writes an auto version holding the figures from before the accept', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 6 }])
    await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 6 }],
    })

    const res = await db.execute(sql`
      SELECT payload FROM kosztorys_snapshots
      WHERE investment_id = ${investmentId} AND kind = 'auto'
      ORDER BY taken_at DESC LIMIT 1
    `)
    const snapshot = res.rows[0]?.payload as {
      progress: { itemId: number; stageId: number; qtyDone: number }[]
    }
    expect(snapshot.progress).toContainEqual(
      expect.objectContaining({ itemId: itemIds[0], stageId: ownStageId, qtyDone: 5 }),
    )
  })

  it('rolls everything back when the accept fails after the tree writes', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: null, qty: 1, opis: 'Wniesienie płyt' },
    ])
    const snapshotsBefore = await snapshotCount()
    const treeBefore = await selectKosztorysTreeData(db, investmentId)
    recording.failNext = true

    await expect(
      accept({
        reportId,
        target: { kind: 'new' },
        lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
        extras: [{ lineId: lineIds[1], acceptedQty: 1, sectionId, clientPrice: 10 }],
      }),
    ).resolves.toMatchObject({ success: false })

    expect((await readWorkerReport(db, investmentId, reportId))?.report.status).toBe('pending')
    expect(await selectKosztorysTreeData(db, investmentId)).toEqual(treeBefore)
    expect(await snapshotCount()).toBe(snapshotsBefore)
  })
})
