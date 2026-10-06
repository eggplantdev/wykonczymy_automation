import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
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

// Collected, not dropped: the extras' translation IS the after() callback.
const scheduled = vi.hoisted(() => [] as (() => Promise<unknown> | unknown)[])
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (task: () => unknown) => void scheduled.push(task) }
})
const flushAfter = async () => {
  for (const task of scheduled.splice(0)) await task()
}

const { translateToPolish } = vi.hoisted(() => ({ translateToPolish: vi.fn() }))
vi.mock('@/lib/ai/translate', () => ({ translateToPolish }))

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
    // The etap already minted his link; pin it to a token the spec can name.
    await payload.update({
      collection: 'worker-report-shares',
      where: { investment: { equals: investmentId }, worker: { equals: workerId } },
      data: { token },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  beforeEach(() => {
    scheduled.length = 0
    translateToPolish.mockReset().mockResolvedValue(new Map())
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('stores the Polish of an extra after the send, leaving the rozpiska line alone', async () => {
    translateToPolish.mockResolvedValue(
      new Map([['Занесення плит', { language: 'uk', polish: 'Wniesienie płyt' }]]),
    )
    const res = await sendWorkerReportAction(token, [
      { kind: 'rozpiska', itemId, qty: 1 },
      { kind: 'extra', description: 'Занесення плит', unit: 'm2', qty: 3 },
    ])
    expect(res.success).toBe(true)
    if (!res.success) return
    expect(translateToPolish).not.toHaveBeenCalled()

    await flushAfter()

    expect(translateToPolish).toHaveBeenCalledWith(['Занесення плит'], { model: undefined })
    const report = await readWorkerReport(db, investmentId, res.data.reportId)
    expect(report?.lines.map((line) => [line.polishDescription, line.descriptionLanguage])).toEqual(
      [
        [null, null],
        ['Wniesienie płyt', 'uk'],
      ],
    )
  })

  it('still sends, leaving the extra untranslated, when the AI throws', async () => {
    translateToPolish.mockRejectedValue(new Error('provider down'))
    const res = await sendWorkerReportAction(token, [
      { kind: 'extra', description: 'Монтаж дверей', unit: 'szt', qty: 1 },
    ])
    expect(res.success).toBe(true)
    if (!res.success) return

    await flushAfter()

    const report = await readWorkerReport(db, investmentId, res.data.reportId)
    expect(report?.lines[0]).toMatchObject({ polishDescription: null, descriptionLanguage: null })
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
    expect(res).toEqual({
      success: false,
      error: 'Ilość musi być większa od zera',
      messageKey: 'qtyPositive',
    })
    expect(await storedReports()).toHaveLength(before.length)
  })

  it('refuses an extra whose j.m. is not on the list', async () => {
    const before = await storedReports()
    const res = await sendWorkerReportAction(token, [
      { kind: 'extra', description: 'Coś', unit: 'beczka', qty: 1 },
    ])
    expect(res).toMatchObject({ success: false, messageKey: 'unknownUnit' })
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
