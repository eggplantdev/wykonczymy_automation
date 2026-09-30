import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { withPayloadTransaction } from '@/lib/db/with-payload-transaction'
import { insertWorkerReport, readWorkerReport } from '@/lib/db/worker-reports'
import { serializeKosztorys } from '@/lib/kosztorys/serialize-kosztorys'
import { restoreKosztorys } from '@/lib/kosztorys/restore-kosztorys'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

// A restore wipes the tree and reinserts it with fresh ids, and the report lines are the first
// table outside the tree to name a pozycja. Nothing in restore knows about them: the FK's
// ON DELETE SET NULL is the whole mechanism, so only the DB can show the report surviving.
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({ success: true, user: { id: 1, role: 'OWNER' } })),
}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('restore keeps worker reports (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let itemId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'restore-keeps-reports-test')
    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Zgłaszający',
        role: 'EMPLOYEE',
        email: 'restore-keeps-reports@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)
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
