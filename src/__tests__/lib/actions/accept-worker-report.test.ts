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
    settleReport: async (...args: Parameters<typeof actual.settleReport>) => {
      if (recording.failNext) throw new Error('record failed')
      return actual.settleReport(...args)
    },
  }
})

const { acceptWorkerReportAction } = await import('@/lib/actions/accept-worker-report')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('acceptWorkerReportAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let otherWorkerId: number
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

  const sendReport = async (
    lines: { itemId: number | null; qty: number; opis?: string; unit?: string }[],
  ) => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: lines.map((line) => ({
        kind: line.itemId === null ? 'extra' : 'rozpiska',
        itemId: line.itemId,
        description: line.opis ?? 'Malowanie ścian',
        unit: line.unit ?? 'm²',
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
    input: Omit<AcceptReportInputT, 'investmentId' | 'undone' | 'rejected' | 'unrejected'> &
      Partial<AcceptReportInputT>,
  ) =>
    acceptWorkerReportAction({
      investmentId,
      undone: [],
      rejected: [],
      unrejected: [],
      ...input,
    })

  const reject = (reportId: number, lineIds: number[]) =>
    accept({ reportId, target: { kind: 'new' }, lines: [], rejected: lineIds })

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

  it('refuses the same decision sent again instead of adding it twice', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
    const input = {
      reportId,
      target: { kind: 'stage' as const, stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
    }
    expect((await accept(input)).success).toBe(true)

    expect((await accept(input)).success).toBe(false)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(7)
  })

  it('accepts the rest later into the etap the report already went to', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: itemIds[1], qty: 4 },
    ])
    const target = { kind: 'stage' as const, stageId: ownStageId }
    await accept({ reportId, target, lines: [{ lineId: lineIds[0], acceptedQty: 2 }] })

    const later = await accept({
      reportId,
      target,
      lines: [{ lineId: lineIds[1], acceptedQty: 4 }],
    })

    expect(later.success).toBe(true)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(7)
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(4)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.report).toMatchObject({ status: 'accepted', acceptedLineCount: 2 })
  })

  it('accepts a line odrzucona earlier, which clears its rejection', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[1], qty: 3 }])
    expect((await reject(reportId, lineIds)).success).toBe(true)

    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 3 }],
    })

    expect(res.success).toBe(true)
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(3)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.report).toMatchObject({ status: 'accepted', rejectedLineCount: 0 })
    expect(stored?.lines[0].isRejected).toBe(false)
  })

  it('accepts an odrzucona praca spoza rozpiski re-pointed at a pozycja', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: null, qty: 22, opis: 'Gniazdo 3-fazowe' },
    ])
    expect((await reject(reportId, lineIds)).success).toBe(true)

    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 22, itemId: itemIds[1] }],
    })

    expect(res).toMatchObject({ success: true })
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(22)
  })

  it('refuses a later accept into another etap than the report went to', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: itemIds[1], qty: 4 },
    ])
    await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
    })

    const later = await accept({
      reportId,
      target: { kind: 'new' },
      lines: [{ lineId: lineIds[1], acceptedQty: 4 }],
    })

    expect(later.success).toBe(false)
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[1].acceptedQty).toBeNull()
  })

  // EX-1034 locks nothing: a report sent before the etap was zakończony still lands in it.
  it('accepts into a zakończony etap', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 3 }])
    await db.execute(sql`UPDATE kosztorys_stages SET completed = true WHERE id = ${ownStageId}`)
    const res = await accept({
      reportId,
      target: { kind: 'stage', stageId: ownStageId },
      lines: [{ lineId: lineIds[0], acceptedQty: 3 }],
    })

    expect(res.success).toBe(true)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(8)
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
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
    const snapshotsBefore = await snapshotCount()
    const treeBefore = await selectKosztorysTreeData(db, investmentId)
    recording.failNext = true

    await expect(
      accept({
        reportId,
        target: { kind: 'new' },
        lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
      }),
    ).resolves.toMatchObject({ success: false })

    expect((await readWorkerReport(db, investmentId, reportId))?.report.status).toBe('pending')
    expect(await selectKosztorysTreeData(db, investmentId)).toEqual(treeBefore)
    expect(await snapshotCount()).toBe(snapshotsBefore)
  })
  const ownTarget = () => ({ kind: 'stage' as const, stageId: ownStageId })

  it('adds only the difference when an accepted ilość is changed', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 7 }] })

    const res = await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 4, seenQty: 7 }],
    })

    expect(res).toMatchObject({
      success: true,
      data: { cells: [{ itemId: itemIds[0], stageId: ownStageId, qtyDone: 9 }] },
    })
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(9)
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[0].acceptedQty).toBe(4)
  })

  it('takes an unticked line back out of the etap and reopens the report', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 7 }] })

    const res = await accept({ reportId, target: ownTarget(), lines: [], undone: [lineIds[0]] })

    expect(res.success).toBe(true)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(5)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.lines[0].acceptedQty).toBeNull()
    expect(stored?.report).toMatchObject({
      status: 'pending',
      decidedAt: null,
      targetStageId: null,
      acceptedLineCount: 0,
    })
  })

  it('keeps its etap while another line stays accepted, and waits on the unticked one', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: itemIds[1], qty: 4 },
    ])
    await accept({
      reportId,
      target: ownTarget(),
      lines: lineIds.map((lineId, index) => ({ lineId, acceptedQty: index === 0 ? 2 : 4 })),
    })

    expect(
      (await accept({ reportId, target: ownTarget(), lines: [], undone: [lineIds[1]] })).success,
    ).toBe(true)

    expect(await qtyDone(itemIds[0], ownStageId)).toBe(7)
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(0)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.report).toMatchObject({
      status: 'pending',
      targetStageId: ownStageId,
      acceptedLineCount: 1,
    })
  })

  // Before the review added a praca spoza rozpiski to the rozpiska first, its accept minted the pozycja
  // and recorded it as `created_item_id`; those lines are still in the database.
  const acceptAsMinted = async (reportId: number, lineId: number, acceptedQty: number) => {
    await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId, acceptedQty, itemId: itemIds[1] }],
    })
    await db.execute(sql`
      UPDATE worker_report_lines SET created_item_id = item_id, item_id = NULL WHERE id = ${lineId}
    `)
    return itemIds[1]
  }

  it('changes an accepted praca spoza rozpiski in the pozycja it created', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: null, qty: 3, opis: 'Wniesienie płyt' },
    ])
    const createdId = await acceptAsMinted(reportId, lineIds[0], 3)

    expect(
      (
        await accept({
          reportId,
          target: ownTarget(),
          lines: [{ lineId: lineIds[0], acceptedQty: 5, seenQty: 3 }],
        })
      ).success,
    ).toBe(true)

    expect(await qtyDone(createdId ?? 0, ownStageId)).toBe(5)
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[0]).toMatchObject({
      acceptedQty: 5,
      createdItemId: createdId,
    })
  })

  it('re-accepts an undone praca spoza rozpiski into the pozycja it created, not a second one', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: null, qty: 3, opis: 'Wniesienie płyt' },
    ])
    const createdId = await acceptAsMinted(reportId, lineIds[0], 3)

    expect(
      (await accept({ reportId, target: ownTarget(), lines: [], undone: [lineIds[0]] })).success,
    ).toBe(true)
    expect(await qtyDone(createdId ?? 0, ownStageId)).toBe(0)
    const undone = await readWorkerReport(db, investmentId, reportId)
    expect(undone?.lines[0]).toMatchObject({ itemId: createdId, createdItemId: null })

    const again = await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
    })
    expect(again.success).toBe(true)
    expect(await qtyDone(createdId ?? 0, ownStageId)).toBe(2)
    expect((await selectKosztorysTreeData(db, investmentId))?.items).toHaveLength(itemIds.length)
  })

  it('stops at zero when the etap was lowered by hand below the accepted ilość', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[1], qty: 6 }])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 6 }] })
    await db.execute(sql`
      UPDATE stage_progress SET qty_done = 2 WHERE item_id = ${itemIds[1]} AND stage_id = ${ownStageId}
    `)

    expect(
      (await accept({ reportId, target: ownTarget(), lines: [], undone: [lineIds[0]] })).success,
    ).toBe(true)
    expect(await qtyDone(itemIds[1], ownStageId)).toBe(0)
  })

  it('only clears the record of an undone line once its etap was deleted', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[1], qty: 6 }])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 6 }] })
    await db.execute(sql`DELETE FROM kosztorys_stages WHERE id = ${ownStageId}`)

    const res = await accept({
      reportId,
      target: { kind: 'new' },
      lines: [],
      undone: [lineIds[0]],
    })

    expect(res).toMatchObject({ success: true, data: { cells: [] } })
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[0].acceptedQty).toBeNull()
  })

  it('refuses the rest into another etap while a line sits in a deleted one', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: itemIds[1], qty: 4 },
    ])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 2 }] })
    await db.execute(sql`DELETE FROM kosztorys_stages WHERE id = ${ownStageId}`)
    const stagesBefore = (await selectKosztorysTreeData(db, investmentId))?.stages

    const later = await accept({
      reportId,
      target: { kind: 'new', plane: 'w_tools' },
      lines: [{ lineId: lineIds[1], acceptedQty: 4 }],
    })

    expect(later.success).toBe(false)
    expect((await selectKosztorysTreeData(db, investmentId))?.stages).toEqual(stagesBefore)
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[1].acceptedQty).toBeNull()

    const afterUntick = await accept({
      reportId,
      target: { kind: 'new', plane: 'w_tools' },
      lines: [{ lineId: lineIds[1], acceptedQty: 4 }],
      undone: [lineIds[0]],
    })
    expect(afterUntick.success).toBe(true)
  })

  it('refuses the rest into another etap once the worker left the one it went to', async () => {
    const { reportId, lineIds } = await sendReport([
      { itemId: itemIds[0], qty: 2 },
      { itemId: itemIds[1], qty: 4 },
    ])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 2 }] })
    await db.execute(sql`
      DELETE FROM kosztorys_stage_workers WHERE stage_id = ${ownStageId} AND worker_id = ${workerId}
    `)

    const later = await accept({
      reportId,
      target: { kind: 'new', plane: 'w_tools' },
      lines: [{ lineId: lineIds[1], acceptedQty: 4 }],
    })

    expect(later.success).toBe(false)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.report.targetStageId).toBe(ownStageId)
    expect(stored?.lines[1].acceptedQty).toBeNull()
  })

  it('refuses a decision built on a line that changed in another window', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
    await accept({ reportId, target: ownTarget(), lines: [{ lineId: lineIds[0], acceptedQty: 7 }] })
    await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 4, seenQty: 7 }],
    })

    const stale = await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 6, seenQty: 7 }],
    })

    expect(stale.success).toBe(false)
    expect(await qtyDone(itemIds[0], ownStageId)).toBe(9)
    expect((await readWorkerReport(db, investmentId, reportId))?.lines[0].acceptedQty).toBe(4)
  })

  it('leaves the report as it was when a save changes nothing', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
    expect((await reject(reportId, lineIds)).success).toBe(true)
    const before = await readWorkerReport(db, investmentId, reportId)
    const snapshotsBefore = await snapshotCount()

    const res = await accept({ reportId, target: ownTarget(), lines: [], undone: [lineIds[0]] })

    expect(res.success).toBe(false)
    expect((await readWorkerReport(db, investmentId, reportId))?.report).toEqual(before?.report)
    expect(await snapshotCount()).toBe(snapshotsBefore)
  })

  it('writes a changed ilość without floating-point noise', async () => {
    const { reportId, lineIds } = await sendReport([{ itemId: itemIds[1], qty: 0.3 }])
    await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 0.3 }],
    })

    await accept({
      reportId,
      target: ownTarget(),
      lines: [{ lineId: lineIds[0], acceptedQty: 0.1, seenQty: 0.3 }],
    })

    expect(await qtyDone(itemIds[1], ownStageId)).toBe(0.1)
  })

  describe('a decision on every line (EX-1049)', () => {
    const twoLines = () =>
      sendReport([
        { itemId: itemIds[0], qty: 2 },
        { itemId: itemIds[1], qty: 4 },
      ])

    it('stays pending while a line still waits', async () => {
      const { reportId, lineIds } = await twoLines()
      await accept({
        reportId,
        target: ownTarget(),
        lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
      })

      expect((await readWorkerReport(db, investmentId, reportId))?.report).toMatchObject({
        status: 'pending',
        targetStageId: ownStageId,
        acceptedLineCount: 1,
        rejectedLineCount: 0,
      })
    })

    it('settles przyjęte once the last waiting line is odrzucona', async () => {
      const { reportId, lineIds } = await twoLines()
      await accept({
        reportId,
        target: ownTarget(),
        lines: [{ lineId: lineIds[0], acceptedQty: 2 }],
      })

      expect((await reject(reportId, [lineIds[1]])).success).toBe(true)

      expect(await qtyDone(itemIds[1], ownStageId)).toBe(0)
      expect((await readWorkerReport(db, investmentId, reportId))?.report).toMatchObject({
        status: 'accepted',
        targetStageId: ownStageId,
        acceptedLineCount: 1,
        rejectedLineCount: 1,
      })
    })

    it('odrzuca every line without touching the rozpiska or writing a version', async () => {
      const { reportId, lineIds } = await twoLines()
      const treeBefore = await selectKosztorysTreeData(db, investmentId)
      const snapshotsBefore = await snapshotCount()

      expect((await reject(reportId, lineIds)).success).toBe(true)

      expect(await selectKosztorysTreeData(db, investmentId)).toEqual(treeBefore)
      expect(await snapshotCount()).toBe(snapshotsBefore)
      const stored = await readWorkerReport(db, investmentId, reportId)
      expect(stored?.report).toMatchObject({
        status: 'rejected',
        targetStageId: null,
        rejectedLineCount: 2,
      })
      expect(stored?.report.decidedAt).not.toBeNull()
    })

    it('sends an odrzucona line back to waiting', async () => {
      const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 2 }])
      await reject(reportId, lineIds)

      const res = await accept({
        reportId,
        target: { kind: 'new' },
        lines: [],
        unrejected: lineIds,
      })

      expect(res.success).toBe(true)
      const stored = await readWorkerReport(db, investmentId, reportId)
      expect(stored?.report).toMatchObject({
        status: 'pending',
        decidedAt: null,
        rejectedLineCount: 0,
      })
      expect(stored?.lines[0].isRejected).toBe(false)
    })

    it('takes the ilość of an accepted line back out when it is odrzucona', async () => {
      const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
      await accept({
        reportId,
        target: ownTarget(),
        lines: [{ lineId: lineIds[0], acceptedQty: 7 }],
      })

      const res = await accept({
        reportId,
        target: ownTarget(),
        lines: [],
        undone: lineIds,
        rejected: lineIds,
      })

      expect(res.success).toBe(true)
      expect(await qtyDone(itemIds[0], ownStageId)).toBe(5)
      const stored = await readWorkerReport(db, investmentId, reportId)
      expect(stored?.lines[0]).toMatchObject({ acceptedQty: null, isRejected: true })
      expect(stored?.report).toMatchObject({ status: 'rejected', targetStageId: null })
    })

    it('refuses to odrzucić a line accepted in another window meanwhile', async () => {
      const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])
      await accept({
        reportId,
        target: ownTarget(),
        lines: [{ lineId: lineIds[0], acceptedQty: 7 }],
      })

      expect((await reject(reportId, lineIds)).success).toBe(false)
      expect(await qtyDone(itemIds[0], ownStageId)).toBe(12)
      expect((await readWorkerReport(db, investmentId, reportId))?.lines[0]).toMatchObject({
        acceptedQty: 7,
        isRejected: false,
      })
    })

    it('refuses one line both accepted and odrzucona', async () => {
      const { reportId, lineIds } = await sendReport([{ itemId: itemIds[0], qty: 8 }])

      const res = await accept({
        reportId,
        target: ownTarget(),
        lines: [{ lineId: lineIds[0], acceptedQty: 8 }],
        rejected: lineIds,
      })

      expect(res.success).toBe(false)
      expect(await qtyDone(itemIds[0], ownStageId)).toBe(5)
      expect((await readWorkerReport(db, investmentId, reportId))?.report.status).toBe('pending')
    })
  })
})
