import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { insertWorkerReport } from '@/lib/db/worker-reports'
import { readWorkerReport } from '@/lib/queries/read-worker-report'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

describe.skipIf(!ENV_READY)('restore keeps worker reports (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let itemId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'restore-keeps-reports-test')
    workerId = await createTestUser(payload, {
      name: 'Zgłaszający',
      email: 'restore-keeps-reports@test.local',
    })
    ;[itemId] = (
      await createKosztorysTree(payload, investmentId, {
        sections: [{ name: 'Salon', items: [{ description: 'Malowanie', unit: 'm2' }] }],
      })
    ).itemIds
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('leaves the report and its copied line, with the pozycja link cleared', async () => {
    const reportId = await insertWorkerReport(db, {
      investmentId,
      workerId,
      lines: [
        {
          kind: 'rozpiska',
          itemId,
          description: 'Malowanie',
          unit: 'm2',
          sectionName: 'Salon',
          reportedQty: 3,
        },
      ],
    })
    const snapshot = await serializeKosztorys(investmentId)

    await withPayloadTransaction(
      payload,
      (req) => restoreKosztorys(payload, req, investmentId, snapshot),
      { skipRevalidation: true },
    )

    const gone = await db.execute(sql`SELECT 1 FROM kosztorys_items WHERE id = ${itemId}`)
    expect(gone.rows).toHaveLength(0)
    const read = await readWorkerReport(db, investmentId, reportId)
    expect(read?.report.status).toBe('pending')
    expect(read?.lines).toEqual([
      expect.objectContaining({
        itemId: null,
        description: 'Malowanie',
        unit: 'm2',
        reportedQty: 3,
      }),
    ])
  })
})
