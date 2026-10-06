import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { decideExpenseDraft, insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import {
  DRAFT_ALREADY_DECIDED,
  DRAFT_PAGES_NOT_ATTACHED,
} from '@/lib/constants/worker-expense-drafts'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
const authState = vi.hoisted(() => ({ userId: 0, role: 'EMPLOYEE' }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'w@t.com', name: 'Worker', role: authState.role },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))
const { reclaimUnreferencedMedia } = vi.hoisted(() => ({ reclaimUnreferencedMedia: vi.fn() }))
vi.mock('@/lib/media/delete-unreferenced-media', () => ({ reclaimUnreferencedMedia }))

// Collected and never run: the read has its own spec, here only its scheduling is the contract.
const scheduled = vi.hoisted(() => [] as unknown[])
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: (task: unknown) => void scheduled.push(task) }
})

const {
  addExpenseDraftPagesAction,
  deleteExpenseDraftAction,
  removeExpenseDraftPageAction,
  restoreExpenseDraftAction,
  sendExpenseDraftAction,
  updateExpenseDraftAction,
} = await import('@/lib/actions/worker-expense-drafts')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-971-worker-'

// The worker's own writes are not a `protectedAction`, so the SQL scope (sender + pending) and the
// target check are all that keeps one worker out of another's drafts and off a stranger's kasa.
describe.skipIf(!ENV_READY)('worker expense draft writes (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let strangerInvestmentId: number
  let workerId: number
  let registerId: number
  let inactiveRegisterId: number
  let otherWorkerId: number
  let otherRegisterId: number

  const ctx = { context: { skipRevalidation: true } }

  async function insertMedia(name: string, uploadedBy: number): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, created_by_id)
      VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${uploadedBy})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  async function createDraft(
    name: string,
    owner: { workerId: number; registerId: number },
    pageCount = 1,
  ): Promise<{ draftId: number; mediaIds: number[] }> {
    const mediaIds: number[] = []
    for (let page = 0; page < pageCount; page++) {
      mediaIds.push(await insertMedia(`${name}-${page}`, owner.workerId))
    }
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId: owner.workerId,
      investmentId,
      cashRegisterId: owner.registerId,
      note: 'przed',
      scanMode: 'one-invoice',
      mediaIds,
    })
    if (draftId === null) throw new Error('draft fixture refused')
    return { draftId, mediaIds }
  }

  const ownDraft = (name: string, pageCount?: number) =>
    createDraft(name, { workerId, registerId }, pageCount)

  const readDraft = async (draftId: number) =>
    (
      await db.execute(sql`
        SELECT status, note, investment_id, cash_register_id, scan_mode FROM worker_expense_drafts
        WHERE id = ${draftId}
      `)
    ).rows[0]

  const readPages = async (draftId: number) =>
    (
      await db.execute(sql`
        SELECT media_id FROM worker_expense_draft_media WHERE draft_id = ${draftId} ORDER BY media_id
      `)
    ).rows.map((row) => Number(row.media_id))

  const draftCount = async () =>
    Number(
      (
        await db.execute(
          sql`SELECT count(*)::int AS total FROM worker_expense_drafts WHERE worker_id = ${workerId}`,
        )
      ).rows[0].total,
    )

  const reject = (draftId: number) =>
    decideExpenseDraft(db, {
      draftId,
      decidedBy: otherWorkerId,
      status: 'rejected',
      transferId: null,
    })

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'worker-expense-writes-db-test')
    strangerInvestmentId = await createTestInvestment(payload, 'worker-expense-writes-stranger')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Writes W', email: 'worker-expense-writes-w@test.local', registerName: 'Kasa W' },
      ctx,
    ))
    ;({ ownerId: otherWorkerId, registerId: otherRegisterId } = await createRegisterOwner(
      payload,
      { name: 'Writes O', email: 'worker-expense-writes-o@test.local', registerName: 'Kasa O' },
      ctx,
    ))
    const inactive = await payload.create({
      collection: 'cash-registers',
      data: { name: 'Kasa W stara', owner: workerId, type: 'AUXILIARY', active: false },
      ...ctx,
    })
    inactiveRegisterId = Number(inactive.id)

    const stage = await payload.create({
      collection: 'kosztorys-stages',
      data: { investment: investmentId, ordinal: 1, splitMode: 'percent' },
      overrideAccess: true,
      ...ctx,
    })
    await db.execute(sql`
      INSERT INTO kosztorys_stage_workers (stage_id, worker_id, value, takes_rest)
      VALUES (${stage.id}, ${workerId}, 50, false), (${stage.id}, ${otherWorkerId}, 50, false)
    `)
  })

  beforeEach(() => {
    authState.userId = workerId
    authState.role = 'EMPLOYEE'
    reclaimUnreferencedMedia.mockReset().mockResolvedValue(undefined)
    scheduled.length = 0
  })

  afterAll(async () => {
    // A pending draft blocks its investment's delete, so the drafts go first or the investments leak.
    await db.execute(
      sql`DELETE FROM worker_expense_drafts WHERE worker_id IN (${workerId}, ${otherWorkerId})`,
    )
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
    for (const id of [investmentId, strangerInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
    await purgeFixtureUsers(db)
  })

  describe('the target a draft is sent to', () => {
    const send = async (name: string, target: { investmentId: number; cashRegisterId: number }) =>
      sendExpenseDraftAction({
        ...target,
        note: '',
        scanMode: 'one-invoice',
        mediaIds: [await insertMedia(name, workerId)],
      })

    it('sends to his own live kasa on an investment he works on', async () => {
      const result = await send('send-ok', { investmentId, cashRegisterId: registerId })

      expect(result).toMatchObject({ success: true })
      if (!result.success) return
      expect(await readDraft(result.data.draftId)).toMatchObject({ status: 'pending' })
    })

    it.each([
      ['another worker’s kasa', 'send-foreign-kasa', () => otherRegisterId],
      ['his own inactive kasa', 'send-inactive-kasa', () => inactiveRegisterId],
    ])('refuses %s and stores nothing', async (_label, photo, kasa) => {
      const before = await draftCount()

      expect(await send(photo, { investmentId, cashRegisterId: kasa() })).toEqual({
        success: false,
        error: 'To nie jest Twoja kasa',
        messageKey: 'notYourRegister',
      })
      expect(await draftCount()).toBe(before)
    })

    it('refuses an investment he has no etap on and stores nothing', async () => {
      const before = await draftCount()

      expect(
        await send('send-stranger', {
          investmentId: strangerInvestmentId,
          cashRegisterId: registerId,
        }),
      ).toEqual({
        success: false,
        error: 'Nie pracujesz na tej inwestycji',
        messageKey: 'notOnInvestment',
      })
      expect(await draftCount()).toBe(before)
    })

    it('an edit is held to the same target check', async () => {
      const { draftId } = await ownDraft('edit-target')
      const before = await readDraft(draftId)

      expect(
        await updateExpenseDraftAction({
          draftId,
          investmentId,
          cashRegisterId: otherRegisterId,
          note: 'po',
          scanMode: 'one-invoice',
        }),
      ).toEqual({
        success: false,
        error: 'To nie jest Twoja kasa',
        messageKey: 'notYourRegister',
      })
      expect(await readDraft(draftId)).toEqual(before)
    })
  })

  describe('another worker’s draft', () => {
    it('cannot be edited, extended, trimmed or deleted', async () => {
      const { draftId, mediaIds } = await createDraft(
        'foreign',
        { workerId: otherWorkerId, registerId: otherRegisterId },
        2,
      )
      const before = await readDraft(draftId)

      const results = [
        await updateExpenseDraftAction({
          draftId,
          investmentId,
          cashRegisterId: registerId,
          note: 'po',
          scanMode: 'one-invoice',
        }),
        await addExpenseDraftPagesAction(draftId, [await insertMedia('foreign-add', workerId)]),
        await removeExpenseDraftPageAction(draftId, mediaIds[0]),
        await deleteExpenseDraftAction(draftId),
      ]

      for (const result of results) expect(result).toMatchObject({ success: false })
      expect(await readDraft(draftId)).toEqual(before)
      expect(await readPages(draftId)).toEqual(mediaIds)
      expect(reclaimUnreferencedMedia).not.toHaveBeenCalled()
    })
  })

  describe('a decided draft', () => {
    it('cannot be edited, extended, trimmed or deleted by its sender', async () => {
      const { draftId, mediaIds } = await ownDraft('decided', 2)
      await reject(draftId)
      const before = await readDraft(draftId)

      expect(
        await updateExpenseDraftAction({
          draftId,
          investmentId,
          cashRegisterId: registerId,
          note: 'po',
          scanMode: 'one-invoice',
        }),
      ).toEqual({
        success: false,
        error: DRAFT_ALREADY_DECIDED,
        messageKey: 'draftAlreadyDecided',
      })
      expect(
        await addExpenseDraftPagesAction(draftId, [await insertMedia('decided-add', workerId)]),
      ).toEqual({
        success: false,
        error: DRAFT_ALREADY_DECIDED,
        messageKey: 'draftAlreadyDecided',
      })
      expect(await removeExpenseDraftPageAction(draftId, mediaIds[0])).toMatchObject({
        success: false,
      })
      expect(await deleteExpenseDraftAction(draftId)).toEqual({
        success: false,
        error: DRAFT_ALREADY_DECIDED,
        messageKey: 'draftAlreadyDecided',
      })

      expect(await readDraft(draftId)).toEqual(before)
      expect(await readPages(draftId)).toEqual(mediaIds)
    })
  })

  describe('the pages of his own pending draft', () => {
    it('appending a photo another user uploaded is refused and adds nothing', async () => {
      const { draftId, mediaIds } = await ownDraft('append-foreign')
      const foreign = await insertMedia('append-foreign-page', otherWorkerId)

      expect(await addExpenseDraftPagesAction(draftId, [foreign])).toEqual({
        success: false,
        error: DRAFT_PAGES_NOT_ATTACHED,
        messageKey: 'attachFailed',
      })
      expect(await readPages(draftId)).toEqual(mediaIds)
    })

    it('the last photo cannot be removed', async () => {
      const { draftId, mediaIds } = await ownDraft('last-page')

      expect(await removeExpenseDraftPageAction(draftId, mediaIds[0])).toMatchObject({
        success: false,
      })
      expect(await readPages(draftId)).toEqual(mediaIds)
      expect(reclaimUnreferencedMedia).not.toHaveBeenCalled()
    })

    it('deleting the draft removes it and hands its photos to the reclaim', async () => {
      const { draftId, mediaIds } = await ownDraft('delete', 2)

      expect(await deleteExpenseDraftAction(draftId)).toEqual({ success: true })
      expect(await readDraft(draftId)).toBeUndefined()
      expect(reclaimUnreferencedMedia).toHaveBeenCalledWith(
        expect.anything(),
        expect.arrayContaining(mediaIds),
      )
    })
  })

  describe('the AI read of his draft', () => {
    const READ = { rows: [{ mediaIds: [0], description: 'Cement' }] }
    const seedRead = (draftId: number) =>
      db.execute(sql`UPDATE worker_expense_drafts SET ai_read = ${JSON.stringify(READ)}::jsonb
        WHERE id = ${draftId}`)
    const readOf = async (draftId: number) =>
      (await db.execute(sql`SELECT ai_read FROM worker_expense_drafts WHERE id = ${draftId}`))
        .rows[0].ai_read
    const edit = (draftId: number, scanMode: 'one-invoice' | 'one-per-photo', note = 'przed') =>
      updateExpenseDraftAction({ draftId, investmentId, cashRegisterId: registerId, note, scanMode })

    it('is asked for once a draft is sent, in the mode the worker chose', async () => {
      const result = await sendExpenseDraftAction({
        investmentId,
        cashRegisterId: registerId,
        note: '',
        scanMode: 'one-per-photo',
        mediaIds: [await insertMedia('read-send', workerId)],
      })

      expect(result).toMatchObject({ success: true })
      if (!result.success) return
      expect(await readDraft(result.data.draftId)).toMatchObject({ scan_mode: 'one-per-photo' })
      expect(scheduled).toHaveLength(1)
    })

    it('an added photo drops the read and asks again', async () => {
      const { draftId } = await ownDraft('read-add')
      await seedRead(draftId)

      expect(
        await addExpenseDraftPagesAction(draftId, [await insertMedia('read-add-page', workerId)]),
      ).toEqual({ success: true })
      expect(await readOf(draftId)).toBeNull()
      expect(scheduled).toHaveLength(1)
    })

    it('a removed photo drops the read and asks again', async () => {
      const { draftId, mediaIds } = await ownDraft('read-remove', 2)
      await seedRead(draftId)

      expect(await removeExpenseDraftPageAction(draftId, mediaIds[0])).toEqual({ success: true })
      expect(await readOf(draftId)).toBeNull()
      expect(scheduled).toHaveLength(1)
    })

    it('a changed mode drops the read and asks again', async () => {
      const { draftId } = await ownDraft('read-mode', 2)
      await seedRead(draftId)

      expect(await edit(draftId, 'one-per-photo')).toEqual({ success: true })
      expect(await readDraft(draftId)).toMatchObject({ scan_mode: 'one-per-photo' })
      expect(await readOf(draftId)).toBeNull()
      expect(scheduled).toHaveLength(1)
    })

    it('an edit that keeps the mode keeps the read and asks nothing', async () => {
      const { draftId } = await ownDraft('read-note', 2)
      await seedRead(draftId)

      expect(await edit(draftId, 'one-invoice', 'po')).toEqual({ success: true })
      expect(await readOf(draftId)).toEqual(READ)
      expect(scheduled).toHaveLength(0)
    })

    it('a refused change keeps the read and asks nothing', async () => {
      const { draftId, mediaIds } = await ownDraft('read-refused')
      await seedRead(draftId)

      expect(await removeExpenseDraftPageAction(draftId, mediaIds[0])).toMatchObject({
        success: false,
      })
      expect(await readOf(draftId)).toEqual(READ)
      expect(scheduled).toHaveLength(0)
    })
  })

  // A manager's action, unlike the rest of this file — the session is not the sender.
  it('„Przywróć” brings back only a rejected draft', async () => {
    const { draftId } = await ownDraft('restore')
    authState.userId = otherWorkerId
    authState.role = 'OWNER'

    expect(await restoreExpenseDraftAction(draftId)).toMatchObject({ success: false })
    expect(await readDraft(draftId)).toMatchObject({ status: 'pending' })

    await reject(draftId)
    expect(await restoreExpenseDraftAction(draftId)).toEqual({ success: true })
    expect(await readDraft(draftId)).toMatchObject({ status: 'pending' })
  })
})
