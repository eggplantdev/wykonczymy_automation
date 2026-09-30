import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkerReports, readWorkerReport } from '@/lib/db/worker-reports'
import type { SendReportLineT } from '@/lib/kosztorys/worker-report/types'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { sendWorkerReportAction } = await import('@/lib/actions/worker-report')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('sendWorkerReportAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let itemId: number
  let token: string

  const storedReports = () => listWorkerReports(db, investmentId, workerId)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-947 send report spec')
    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Jan Zgłaszający',
        role: 'EMPLOYEE',
        email: 'send-report@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)
    ;({
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'Malowanie ścian', unit: 'm2', plannedQty: 40 }] },
      ],
      stages: [{ worker: workerId, plane: 'w_tools' }],
    }))
    token = `test-send-report-${process.pid}-${Date.now()}`
    await payload.create({
      collection: 'worker-report-shares',
      data: { investment: investmentId, worker: workerId, token },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('stores opis, j.m. and sekcja copied from the live pozycja, not from the client', async () => {
    // A tampered client: extra fields claiming other text ride along and must be ignored.
    const tampered = {
      kind: 'rozpiska',
      itemId,
      qty: 12.5,
      description: 'Coś innego',
      unit: 'kpl',
      sectionName: 'Łazienka',
    } as SendReportLineT
    const res = await sendWorkerReportAction(token, [
      tampered,
      { kind: 'extra', description: 'Wniesienie płyt', unit: 'm2', qty: 3 },
    ])
    expect(res.success).toBe(true)
    if (!res.success) return

    const report = await readWorkerReport(db, investmentId, res.data.reportId)
    expect(report?.report.status).toBe('pending')
    expect(report?.lines).toEqual([
      expect.objectContaining({
        kind: 'rozpiska',
        itemId,
        description: 'Malowanie ścian',
        unit: 'm2',
        sectionName: 'Salon',
        reportedQty: 12.5,
      }),
      expect.objectContaining({
        kind: 'extra',
        itemId: null,
        description: 'Wniesienie płyt',
        // An extra's j.m. goes through cleanUnit, so it matches the list the kierownik picks from.
        unit: 'm²',
        sectionName: null,
        reportedQty: 3,
      }),
    ])
  })

  it('refuses a report with no lines and stores nothing', async () => {
    const before = await storedReports()
    const res = await sendWorkerReportAction(token, [])
    expect(res.success).toBe(false)
    expect(await storedReports()).toHaveLength(before.length)
  })

  it.each([0, -2])('refuses a quantity of %s and stores nothing', async (qty) => {
    const before = await storedReports()
    const res = await sendWorkerReportAction(token, [{ kind: 'rozpiska', itemId, qty }])
    expect(res).toEqual({ success: false, error: 'Ilość musi być większa od zera' })
    expect(await storedReports()).toHaveLength(before.length)
  })

  it('refuses an extra whose j.m. is not on the list', async () => {
    const before = await storedReports()
    const res = await sendWorkerReportAction(token, [
      { kind: 'extra', description: 'Coś', unit: 'beczka', qty: 1 },
    ])
    expect(res.success).toBe(false)
    expect(await storedReports()).toHaveLength(before.length)
  })

  it('refuses a send once the investment is zakończona', async () => {
    const before = await storedReports()
    await db.execute(sql`UPDATE investments SET status = 'completed' WHERE id = ${investmentId}`)
    const res = await sendWorkerReportAction(token, [{ kind: 'rozpiska', itemId, qty: 1 }])
    await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${investmentId}`)
    expect(res.success).toBe(false)
    expect(await storedReports()).toHaveLength(before.length)
  })
})
