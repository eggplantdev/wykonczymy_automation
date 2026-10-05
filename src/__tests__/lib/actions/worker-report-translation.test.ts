import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { FALLBACK_MODEL } from '@/lib/ai/openrouter'
import { insertWorkerReport, readWorkerReport, type WorkerReportLineInputT } from '@/lib/db/worker-reports'
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

const { translateToPolish } = vi.hoisted(() => ({ translateToPolish: vi.fn() }))
vi.mock('@/lib/ai/translate', () => ({ translateToPolish }))

const { retranslateReportLineAction } = await import('@/lib/actions/worker-report-translation')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const ORIGINAL = 'Занесення плит'

describe.skipIf(!ENV_READY)('retranslateReportLineAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let workerId: number
  let itemId: number

  const extra: WorkerReportLineInputT = {
    kind: 'extra',
    itemId: null,
    description: ORIGINAL,
    unit: 'm²',
    sectionName: null,
    reportedQty: 2,
  }

  const sendReport = async (lines: WorkerReportLineInputT[]) => {
    const reportId = await insertWorkerReport(db, { investmentId, workerId, lines })
    const stored = await readWorkerReport(db, investmentId, reportId)
    return { reportId, lineIds: stored?.lines.map((line) => line.id) ?? [] }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    const users = await payload.find({ collection: 'users', limit: 1, depth: 0 })
    authState.userId = Number(users.docs[0]?.id)
    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Jan Zgłaszający',
        role: 'EMPLOYEE',
        email: 'retranslate-report@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)
    investmentId = await createTestInvestment(payload, 'EX-992 retranslate spec')
    otherInvestmentId = await createTestInvestment(payload, 'EX-992 retranslate spec other')
    ;({
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [{ name: 'Salon', items: [{ description: 'Malowanie ścian', unit: 'm²' }] }],
    }))
  })

  beforeEach(() => {
    translateToPolish
      .mockReset()
      .mockResolvedValue(new Map([[ORIGINAL, { language: 'uk', polish: 'Wniesienie płyt' }]]))
  })

  afterAll(async () => {
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id)
    }
    await purgeFixtureUsers(db)
  })

  it('asks the stronger model and stores the new pair over the old one', async () => {
    const { reportId, lineIds } = await sendReport([extra])
    await db.execute(sql`
      UPDATE worker_report_lines SET polish_description = 'Złe', description_language = 'uk'
      WHERE id = ${lineIds[0]}`)

    const res = await retranslateReportLineAction(investmentId, lineIds[0])

    expect(translateToPolish).toHaveBeenCalledWith([ORIGINAL], { model: FALLBACK_MODEL })
    expect(res).toEqual({
      success: true,
      data: { polishDescription: 'Wniesienie płyt', descriptionLanguage: 'uk' },
    })
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.lines[0]).toMatchObject({
      polishDescription: 'Wniesienie płyt',
      descriptionLanguage: 'uk',
    })
  })

  it('fails without touching the line when the model gives no answer', async () => {
    translateToPolish.mockResolvedValue(new Map())
    const { reportId, lineIds } = await sendReport([extra])

    const res = await retranslateReportLineAction(investmentId, lineIds[0])

    expect(res.success).toBe(false)
    const stored = await readWorkerReport(db, investmentId, reportId)
    expect(stored?.lines[0]).toMatchObject({ polishDescription: null, descriptionLanguage: null })
  })

  it('refuses a rozpiska line', async () => {
    const { lineIds } = await sendReport([
      { kind: 'rozpiska', itemId, description: 'Malowanie ścian', unit: 'm²', sectionName: 'Salon', reportedQty: 1 },
    ])
    expect((await retranslateReportLineAction(investmentId, lineIds[0])).success).toBe(false)
    expect(translateToPolish).not.toHaveBeenCalled()
  })

  it('refuses a line of a report already decided', async () => {
    const { reportId, lineIds } = await sendReport([extra])
    await db.execute(sql`UPDATE worker_reports SET status = 'rejected', decided_at = now() WHERE id = ${reportId}`)
    expect((await retranslateReportLineAction(investmentId, lineIds[0])).success).toBe(false)
    expect(translateToPolish).not.toHaveBeenCalled()
  })

  it('refuses a line named through another investment', async () => {
    const { lineIds } = await sendReport([extra])
    expect((await retranslateReportLineAction(otherInvestmentId, lineIds[0])).success).toBe(false)
    expect(translateToPolish).not.toHaveBeenCalled()
  })
})
