import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  claimPendingReport,
  insertScannedReport,
  insertWorkerReport,
  listDecidableReports,
  listReportFilterOptions,
  listReportsByWorker,
  readReportPreview,
  readWorkerReport,
  type WorkerReportFiltersT,
} from '@/lib/db/worker-reports'
import { setLineTranslations } from '@/lib/db/worker-report-line-translations'
import { ALL_TIME } from '@/lib/utils/date-range'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'worker-reports-db-test-'

const NO_REPORT_FILTERS: WorkerReportFiltersT = {
  statuses: null,
  investmentIds: null,
  workerIds: null,
  sentRange: ALL_TIME,
}

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
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
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

  it('lists a decided report after the pending queue, not only the queue', async () => {
    const rejected = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })
    await claimPendingReport(db, investmentId, rejected, 'rejected', otherWorkerId)
    const pending = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [rozpiskaLine(itemIds[0], 1)],
    })

    const { rows: ours } = await listDecidableReports(
      db,
      { ...NO_REPORT_FILTERS, investmentIds: [investmentId] },
      { page: 1, limit: 100 },
    )
    const order = ours.map((row) => row.id)

    expect(ours.find((row) => row.id === rejected)).toMatchObject({ status: 'rejected' })
    expect(order.indexOf(pending)).toBeLessThan(order.indexOf(rejected))
    expect(ours.findLastIndex((row) => row.status === 'pending')).toBeLessThan(
      ours.findIndex((row) => row.status !== 'pending'),
    )
  })

  it('filters the list by status, investment, worker and Warsaw sent day, and pages it', async () => {
    const line = [rozpiskaLine(itemIds[0], 1)]
    const rejected = await insertWorkerReport(db, {
      investmentId: otherInvestmentId,
      workerId,
      lines: line,
    })
    await claimPendingReport(db, otherInvestmentId, rejected, 'rejected', otherWorkerId)
    const byOtherWorker = await insertWorkerReport(db, {
      investmentId: otherInvestmentId,
      workerId: otherWorkerId,
      lines: line,
    })
    const pastMidnight = await insertWorkerReport(db, {
      investmentId: otherInvestmentId,
      workerId,
      lines: line,
    })
    // 00:30 on 1 April in Warsaw, still 31 March in UTC.
    await db.execute(
      sql`UPDATE worker_reports SET sent_at = '2026-03-31T22:30:00Z' WHERE id = ${pastMidnight}`,
    )

    const scope = { ...NO_REPORT_FILTERS, investmentIds: [otherInvestmentId] }
    const ids = async (filters: WorkerReportFiltersT) =>
      (await listDecidableReports(db, filters, { page: 1, limit: 100 })).rows.map((row) => row.id)

    expect(await ids({ ...scope, statuses: ['rejected'] })).toEqual([rejected])
    expect(await ids({ ...scope, workerIds: [otherWorkerId] })).toEqual([byOtherWorker])
    expect(await ids({ ...scope, sentRange: { from: '2026-04-01', to: '2026-04-01' } })).toEqual([
      pastMidnight,
    ])
    expect(await ids({ ...scope, statuses: [] })).toEqual([])
    // dayBound refuses it, but the query must not depend on that: a `::date` cast would throw.
    expect(await ids({ ...scope, sentRange: { from: '2026-02-30' } })).toHaveLength(3)

    const secondPage = await listDecidableReports(db, scope, { page: 2, limit: 2 })
    expect(secondPage.totalDocs).toBe(3)
    expect(secondPage.rows.map((row) => row.id)).toEqual([rejected])

    const options = await listReportFilterOptions(db)
    expect(options.investments.map((item) => item.id)).toContain(otherInvestmentId)
    expect(options.workers.map((item) => item.id)).toEqual(
      expect.arrayContaining([workerId, otherWorkerId]),
    )
  })

  it('sorts the whole list in the query, so a later page continues the order', async () => {
    const report = async (sentAt: string) => {
      const id = await insertWorkerReport(db, {
        investmentId: otherInvestmentId,
        workerId,
        lines: [rozpiskaLine(itemIds[0], 1)],
      })
      await db.execute(sql`UPDATE worker_reports SET sent_at = ${sentAt} WHERE id = ${id}`)
      return id
    }
    const oldest = await report('2025-01-05T10:00:00Z')
    const middle = await report('2025-01-10T10:00:00Z')
    const accepted = await report('2025-01-12T10:00:00Z')
    const newest = await report('2025-01-15T10:00:00Z')
    await claimPendingReport(db, otherInvestmentId, accepted, 'accepted', otherWorkerId)
    await claimPendingReport(db, otherInvestmentId, newest, 'rejected', otherWorkerId)

    // January 2025 keeps the earlier tests' reports on this investment out of the count.
    const scope: WorkerReportFiltersT = {
      ...NO_REPORT_FILTERS,
      investmentIds: [otherInvestmentId],
      sentRange: { from: '2025-01-01', to: '2025-01-31' },
    }
    const onPage = async (page: number, sort?: string) =>
      (await listDecidableReports(db, scope, { page, limit: 1 }, sort)).rows.map((row) => row.id)

    expect(await onPage(2, 'sentAt')).toEqual([middle])
    expect(await onPage(1, '-sentAt')).toEqual([newest])
    // Queue order, where alphabetical would lead with `accepted`; ties newest first either way.
    expect(await onPage(1, 'status')).toEqual([middle])
    expect(await onPage(3, 'status')).toEqual([accepted])
    expect(await onPage(2, '-status')).toEqual([accepted])
    // No sort, or an unknown column: the queue — pending newest first.
    expect(await onPage(1)).toEqual([middle])
    expect(await onPage(1, 'id; DROP TABLE users')).toEqual([middle])
    expect(await onPage(2)).toEqual([oldest])
    expect(await onPage(3)).toEqual([newest])
  })

  const extra = (description: string) => ({
    kind: 'extra' as const,
    itemId: null,
    description,
    unit: 'm2',
    sectionName: null,
    reportedQty: 1,
  })

  it('never lets the send-time translation overwrite a line a retry already translated', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [extra('Занесення плит'), extra('Монтаж дверей')],
    })
    const [retried, untouched] = (await readWorkerReport(db, investmentId, reportId))!.lines
    await setLineTranslations(
      db,
      [{ id: retried.id, polishDescription: 'Wniesienie płyt', descriptionLanguage: 'uk' }],
      { onlyUntranslated: false },
    )

    await setLineTranslations(
      db,
      [
        { id: retried.id, polishDescription: 'Gorsze', descriptionLanguage: 'uk' },
        { id: untouched.id, polishDescription: 'Montaż drzwi', descriptionLanguage: 'uk' },
      ],
      { onlyUntranslated: true },
    )

    const lines = (await readWorkerReport(db, investmentId, reportId))!.lines
    expect(lines.map((line) => line.polishDescription)).toEqual(['Wniesienie płyt', 'Montaż drzwi'])
  })

  it('writes no translation onto a line whose report was decided during the model call', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [extra('Занесення плит')],
    })
    const [line] = (await readWorkerReport(db, investmentId, reportId))!.lines
    await db.execute(
      sql`UPDATE worker_reports SET status = 'rejected', decided_at = now() WHERE id = ${reportId}`,
    )

    await setLineTranslations(
      db,
      [{ id: line.id, polishDescription: 'Wniesienie płyt', descriptionLanguage: 'uk' }],
      { onlyUntranslated: false },
    )

    const [stored] = (await readWorkerReport(db, investmentId, reportId))!.lines
    expect(stored).toMatchObject({ polishDescription: null, descriptionLanguage: null })
  })

  describe('Podgląd and the worker history', () => {
    const MANAGER = { id: -1, isManagement: true }
    const workerViewer = () => ({ id: workerId, isManagement: false })

    // Raw INSERT: an upload through Payload would push bytes at the Blob store for a fixture nothing opens.
    async function insertMedia(name: string, uploadedBy: number): Promise<number> {
      const { rows } = await db.execute(sql`
        INSERT INTO media (filename, mime_type, filesize, created_by_id)
        VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${uploadedBy})
        RETURNING id
      `)
      return Number(rows[0].id)
    }

    it('returns null for another worker and for a missing id, the same answer for both', async () => {
      const othersReport = await insertWorkerReport(db, {
        investmentId,
        workerId: otherWorkerId,
        lines: [rozpiskaLine(itemIds[0], 1)],
      })

      expect(await readReportPreview(db, othersReport, workerViewer())).toBeNull()
      expect(await readReportPreview(db, 2_000_000_000, workerViewer())).toBeNull()
      expect((await readReportPreview(db, othersReport, MANAGER))?.report).toMatchObject({
        id: othersReport,
        workerId: otherWorkerId,
        investmentName: 'worker-reports-db-test',
      })
    })

    it('gives the worker his own scan with its lines and photos', async () => {
      const photo = await insertMedia('scan-page', otherWorkerId)
      const reportId = await insertScannedReport(db, {
        investmentId,
        workerId,
        createdById: otherWorkerId,
        mediaIds: [photo],
        lines: [rozpiskaLine(itemIds[0], 2), extra('Listwy')],
      })

      const preview = await readReportPreview(db, Number(reportId), workerViewer())

      expect(preview?.report).toMatchObject({ source: 'scan', lineCount: 2 })
      expect(preview?.media.map((file) => file.id)).toEqual([photo])
      expect(preview?.lines[0]).toMatchObject({
        kind: 'rozpiska',
        itemDescription: 'Malowanie',
        sectionName: 'Salon',
        reportedQty: 2,
      })
      expect(preview?.lines[0].ref).toEqual(expect.any(Number))
      expect(preview?.lines[1]).toMatchObject({ kind: 'extra', ref: null, itemDescription: null })
    })

    it('carries the pozycja an accepted extra became, and the snapshot of a deleted one', async () => {
      const { itemIds: doomed } = await createKosztorysTree(payload, otherInvestmentId, {
        sections: [{ name: 'Kuchnia', items: [{ description: 'Do usunięcia' }] }],
      })
      const reportId = await insertWorkerReport(db, {
        investmentId,
        workerId,
        lines: [
          { ...rozpiskaLine(doomed[0], 1), description: 'Stary opis', sectionName: 'Kuchnia' },
          extra('Skucie płytek'),
        ],
      })
      await claimPendingReport(db, investmentId, reportId, 'accepted', otherWorkerId)
      await db.execute(sql`
        UPDATE worker_report_lines SET accepted_qty = 1, created_item_id = ${itemIds[1]}
        WHERE report_id = ${reportId} AND kind = 'extra'
      `)
      await db.execute(sql`DELETE FROM kosztorys_items WHERE id = ${doomed[0]}`)

      const preview = await readReportPreview(db, reportId, workerViewer())
      const [deleted, accepted] = preview!.lines

      expect(deleted).toMatchObject({
        itemId: null,
        ref: null,
        itemDescription: null,
        description: 'Stary opis',
        sectionName: 'Kuchnia',
        acceptedQty: null,
      })
      expect(accepted).toMatchObject({
        acceptedQty: 1,
        createdItemId: itemIds[1],
        itemDescription: 'Gładź',
        sectionName: 'Salon',
      })
      expect(accepted.ref).toEqual(expect.any(Number))
      expect(preview?.report).toMatchObject({
        status: 'accepted',
        decidedByName: 'worker-reports-b@test.local',
      })
    })

    it('lists his scans and his reports on a trashed investment, and nobody else’s', async () => {
      const trashed = await createTestInvestment(payload, 'worker-reports-db-test-trashed')
      try {
        const onTrashed = await insertWorkerReport(db, {
          investmentId: trashed,
          workerId,
          lines: [extra('Na usuniętej')],
        })
        await db.execute(sql`UPDATE investments SET trashed_at = now() WHERE id = ${trashed}`)
        const scan = await insertScannedReport(db, {
          investmentId,
          workerId,
          createdById: otherWorkerId,
          mediaIds: [await insertMedia('history-scan', otherWorkerId)],
          lines: [extra('Ze skanu')],
        })
        const others = await insertWorkerReport(db, {
          investmentId,
          workerId: otherWorkerId,
          lines: [extra('Cudze')],
        })

        const ids = (await listReportsByWorker(db, workerId)).map((row) => row.id)

        expect(ids).toEqual(expect.arrayContaining([onTrashed, Number(scan)]))
        expect(ids).not.toContain(others)
        expect(
          (await listReportsByWorker(db, workerId)).find((row) => row.id === onTrashed),
        ).toMatchObject({ investmentName: 'worker-reports-db-test-trashed', source: 'link' })
      } finally {
        await deleteTestInvestment(payload, trashed).catch(() => {})
      }
    })

    it('gives the manager list its source and decision', async () => {
      const reportId = await insertWorkerReport(db, {
        investmentId,
        workerId,
        lines: [rozpiskaLine(itemIds[0], 1)],
      })
      await claimPendingReport(db, investmentId, reportId, 'rejected', otherWorkerId)

      const { rows } = await listDecidableReports(
        db,
        { ...NO_REPORT_FILTERS, investmentIds: [investmentId] },
        { page: 1, limit: 100 },
      )

      expect(rows.find((row) => row.id === reportId)).toMatchObject({
        source: 'link',
        decidedAt: expect.any(String),
        decidedByName: 'worker-reports-b@test.local',
      })
    })
  })
})
