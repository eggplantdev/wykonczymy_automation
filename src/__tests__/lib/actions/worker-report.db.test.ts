import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { listWorkerReports } from '@/lib/db/worker-reports'
import { readWorkerReport } from '@/lib/queries/read-worker-report'
import type { SendReportLineT } from '@/lib/kosztorys/worker-report/types'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'
import { flushAfter } from '@/__tests__/stubs/next-server'
import { translateToPolish } from '@/lib/ai/translate'
import { sendWorkerReportAction } from '@/lib/actions/worker-report'

describe.skipIf(!ENV_READY)('sendWorkerReportAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let itemId: number
  let token: string

  const storedReports = () => listWorkerReports(db, investmentId, workerId)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'EX-947 send report spec')
    workerId = await createTestUser(payload, {
      name: 'Jan Zgłaszający',
      email: 'send-report@test.local',
    })
    ;({
      itemIds: [itemId],
    } = await createKosztorysTree(payload, investmentId, {
      sections: [
        { name: 'Salon', items: [{ description: 'Malowanie ścian', unit: 'm2', plannedQty: 40 }] },
      ],
      stages: [{ worker: workerId, plane: 'w_tools' }],
    }))
    token = `test-send-report-${process.pid}-${Date.now()}`
    await payload.update({
      collection: 'worker-report-shares',
      where: { investment: { equals: investmentId }, worker: { equals: workerId } },
      data: { token },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  })

  beforeEach(() => {
    vi.mocked(translateToPolish).mockResolvedValue(new Map())
  })

  afterAll(async () => {
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    await purgeFixtureUsers(db)
  })

  it('stores the Polish of an extra after the send, leaving the rozpiska line alone', async () => {
    vi.mocked(translateToPolish).mockResolvedValue(
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
    vi.mocked(translateToPolish).mockRejectedValue(new Error('provider down'))
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
