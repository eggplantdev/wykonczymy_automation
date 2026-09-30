import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  claimPendingReport,
  insertWorkerReport,
  pendingQtyByItem,
  readWorkerReport,
} from '@/lib/db/worker-reports'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('worker report data access (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let workerId: number
  let otherWorkerId: number
  let itemIds: number[]

  async function createWorker(email: string) {
    const user = await payload.create({
      collection: 'users',
      data: { name: email, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(user.id)
  }

  const rozpiskaLine = (itemId: number, reportedQty: number) => ({
    kind: 'rozpiska' as const,
    itemId,
    description: 'Malowanie',
    unit: 'm2',
    sectionName: 'Salon',
    reportedQty,
  })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'worker-reports-db-test')
    otherInvestmentId = await createTestInvestment(payload, 'worker-reports-db-test-other')
    workerId = await createWorker('worker-reports-a@test.local')
    otherWorkerId = await createWorker('worker-reports-b@test.local')
    ;({ itemIds } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'Malowanie' }, { description: 'Gładź' }] },
      ],
    }))
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
    await purgeFixtureUsers(db)
  })

  it('stores a report with its lines and reads them back in order', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [
        rozpiskaLine(itemIds[0], 12.5),
        {
          kind: 'extra',
          itemId: null,
          description: 'Skucie płytek',
          unit: 'm2',
          sectionName: null,
          reportedQty: 3,
        },
      ],
    })

    const read = await readWorkerReport(db, investmentId, reportId)

    expect(read?.report).toMatchObject({
      workerId,
      status: 'pending',
      decidedAt: null,
      lineCount: 2,
      acceptedLineCount: 0,
    })
    expect(
      read?.lines.map(({ kind, itemId, description, reportedQty, acceptedQty }) => ({
        kind,
        itemId,
        description,
        reportedQty,
        acceptedQty,
      })),
    ).toEqual([
      {
        kind: 'rozpiska',
        itemId: itemIds[0],
        description: 'Malowanie',
        reportedQty: 12.5,
        acceptedQty: null,
      },
      {
        kind: 'extra',
        itemId: null,
        description: 'Skucie płytek',
        reportedQty: 3,
        acceptedQty: null,
      },
    ])
  })

  it('does not read a report through another investment', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })

    expect(await readWorkerReport(db, otherInvestmentId, reportId)).toBeNull()
  })

  it('refuses a decided status without a decision time, and a pending one with it', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })

    await expect(
      db.execute(sql`UPDATE worker_reports SET status = 'accepted' WHERE id = ${reportId}`),
    ).rejects.toThrow()
    await expect(
      db.execute(sql`UPDATE worker_reports SET decided_at = now() WHERE id = ${reportId}`),
    ).rejects.toThrow()
  })

  it('claims a pending report once; the second claim changes nothing', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })

    expect(await claimPendingReport(db, investmentId, reportId, 'rejected', otherWorkerId)).toBe(
      workerId,
    )
    expect(
      await claimPendingReport(db, investmentId, reportId, 'accepted', otherWorkerId),
    ).toBeNull()

    const read = await readWorkerReport(db, investmentId, reportId)
    expect(read?.report.status).toBe('rejected')
  })

  it('refuses a claim through another investment', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })

    expect(
      await claimPendingReport(db, otherInvestmentId, reportId, 'rejected', otherWorkerId),
    ).toBeNull()
    expect((await readWorkerReport(db, investmentId, reportId))?.report.status).toBe('pending')
  })

  it('sums only this worker’s pending lines per pozycja', async () => {
    const [probe] = itemIds.slice(1)
    await insertWorkerReport(db, { investmentId, workerId, lines: [rozpiskaLine(probe, 2)] })
    await insertWorkerReport(db, { investmentId, workerId, lines: [rozpiskaLine(probe, 0.5)] })
    const decided = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(probe, 100)],
    })
    await claimPendingReport(db, investmentId, decided, 'accepted', otherWorkerId)
    await insertWorkerReport(db, {
      investmentId,
      workerId: otherWorkerId,
      lines: [rozpiskaLine(probe, 40)],
    })

    const pending = await pendingQtyByItem(db, investmentId, workerId)

    expect(pending.get(probe)).toBe(2.5)
  })
})
