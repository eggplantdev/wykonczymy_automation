import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertMediaRow } from '@/lib/db/media'
import { decideExpenseDraft, insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import { pl } from '@/lib/i18n/dictionaries/pl'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createRegisterOwner, createTestRegister } from '@/__tests__/helpers/register'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createKosztorysTree } from '@/__tests__/helpers/kosztorys-db-tree'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { insertTestMedia, purgeTestMedia } from '@/__tests__/helpers/media'
import { scheduled } from '@/__tests__/stubs/next-server'

const { reclaimUnreferencedMedia } = vi.hoisted(() => ({ reclaimUnreferencedMedia: vi.fn() }))
vi.mock('@/lib/media/delete-unreferenced-media', () => ({ reclaimUnreferencedMedia }))

const { deleteExpenseDraftAction, restoreExpenseDraftAction, sendExpenseDraftAction } =
  await import('@/lib/actions/worker-expense-drafts')

const FILENAME_PREFIX = 'ex-971-worker-'

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

  const insertMedia = (name: string, uploadedBy: number) =>
    insertTestMedia(db, `${FILENAME_PREFIX}${name}.jpg`, { kind: null, createdById: uploadedBy })

  async function createDraft(
    name: string,
    owner: { workerId: number; registerId: number },
    pageCount = 1,
    onInvestment: number | null = investmentId,
  ): Promise<{ draftId: number; mediaIds: number[] }> {
    const mediaIds: number[] = []
    for (let page = 0; page < pageCount; page++) {
      mediaIds.push(await insertMedia(`${name}-${page}`, owner.workerId))
    }
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId: owner.workerId,
      investmentId: onInvestment,
      cashRegisterId: owner.registerId,
      note: 'przed',
      mediaIds,
    })
    if (draftId === null) throw new Error('draft fixture refused')
    return { draftId, mediaIds }
  }

  const ownDraft = (name: string, pageCount?: number, onInvestment?: number | null) =>
    createDraft(name, { workerId, registerId }, pageCount, onInvestment)

  const send = async (
    name: string,
    target: { investmentId: number | null; cashRegisterId: number },
  ) =>
    sendExpenseDraftAction({
      ...target,
      note: '',
      mediaIds: [await insertMedia(name, workerId)],
    })

  const readDraft = async (draftId: number) =>
    (
      await db.execute(sql`
        SELECT status, note, investment_id, cash_register_id FROM worker_expense_drafts
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
      transferIds: [],
    })

  beforeAll(async () => {
    payload = await bootTestPayload()
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
    inactiveRegisterId = await createTestRegister(payload, workerId, 'Kasa W stara', {
      active: false,
    })

    const {
      stageIds: [stageId],
    } = await createKosztorysTree(payload, investmentId, { sections: [], stages: [{ ordinal: 1 }] })
    await db.execute(sql`
      INSERT INTO kosztorys_stage_workers (stage_id, worker_id, value, takes_rest)
      VALUES (${stageId}, ${workerId}, 50, false), (${stageId}, ${otherWorkerId}, 50, false)
    `)
  })

  beforeEach(() => {
    authState.userId = workerId
    authState.role = 'EMPLOYEE'
    reclaimUnreferencedMedia.mockReset().mockResolvedValue(undefined)
  })

  afterAll(async () => {
    // A pending draft blocks its investment's delete, so the drafts go first or the investments leak.
    await db.execute(
      sql`DELETE FROM worker_expense_drafts WHERE worker_id IN (${workerId}, ${otherWorkerId})`,
    )
    await purgeTestMedia(db, FILENAME_PREFIX)
    for (const id of [investmentId, strangerInvestmentId]) {
      if (id) await deleteTestInvestment(payload, id).catch(() => {})
    }
    await purgeFixtureUsers(db)
  })

  describe('the target a draft is sent to', () => {
    it('sends to his own live kasa on an investment he works on', async () => {
      const result = await send('send-ok', { investmentId, cashRegisterId: registerId })

      expect(result).toMatchObject({ success: true })
      if (!result.success) return
      expect(await readDraft(result.data.draftId)).toMatchObject({ status: 'pending' })
    })

    it('accepts a photo stored by the fast upload path', async () => {
      const mediaId = await insertMediaRow(db, {
        filename: `${FILENAME_PREFIX}send-fast-path.jpg`,
        mimeType: 'image/jpeg',
        filesize: 1024,
        kind: 'faktura',
        createdById: workerId,
      })

      const result = await sendExpenseDraftAction({
        investmentId,
        cashRegisterId: registerId,
        note: '',
        mediaIds: [mediaId],
      })

      expect(result).toMatchObject({ success: true })
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

    describe('once his etapy on the investment are zakończone', () => {
      const setCompleted = (isCompleted: boolean) =>
        db.execute(sql`
          UPDATE kosztorys_stages SET completed = ${isCompleted} WHERE investment_id = ${investmentId}
        `)

      it('refuses a new draft onto it and stores nothing', async () => {
        await setCompleted(true)
        try {
          const before = await draftCount()

          expect(
            await send('send-completed', { investmentId, cashRegisterId: registerId }),
          ).toEqual({
            success: false,
            error: 'Nie pracujesz na tej inwestycji',
            messageKey: 'notOnInvestment',
          })
          expect(await draftCount()).toBe(before)
        } finally {
          await setCompleted(false)
        }
      })
    })
  })

  describe('a draft without an investment', () => {
    const setFlag = (isFlagged: boolean) =>
      db.execute(sql`
        UPDATE users SET can_add_expenses_without_investment = ${isFlagged} WHERE id = ${workerId}
      `)

    const sendWithout = (name: string, cashRegisterId = registerId) =>
      send(name, { investmentId: null, cashRegisterId })

    beforeEach(() => setFlag(false))
    afterAll(() => setFlag(false))

    it('a flagged worker sends one and it is stored with no investment', async () => {
      await setFlag(true)

      const result = await sendWithout('none-send-flagged')

      expect(result).toMatchObject({ success: true })
      if (!result.success) return
      expect(await readDraft(result.data.draftId)).toMatchObject({
        status: 'pending',
        investment_id: null,
      })
    })

    it('an unflagged worker is refused and nothing is stored', async () => {
      const before = await draftCount()

      expect(await sendWithout('none-send-unflagged')).toMatchObject({
        success: false,
        messageKey: 'chooseInvestment',
      })
      expect(await draftCount()).toBe(before)
    })

    it('a flagged worker is still held to his own kasa', async () => {
      await setFlag(true)
      const before = await draftCount()

      expect(await sendWithout('none-send-foreign-kasa', otherRegisterId)).toMatchObject({
        success: false,
        messageKey: 'notYourRegister',
      })
      expect(await draftCount()).toBe(before)
    })
  })

  describe('another worker’s draft', () => {
    it('cannot be deleted', async () => {
      const { draftId, mediaIds } = await createDraft(
        'foreign',
        { workerId: otherWorkerId, registerId: otherRegisterId },
        2,
      )
      const before = await readDraft(draftId)

      expect(await deleteExpenseDraftAction(draftId)).toMatchObject({ success: false })
      expect(await readDraft(draftId)).toEqual(before)
      expect(await readPages(draftId)).toEqual(mediaIds)
      expect(reclaimUnreferencedMedia).not.toHaveBeenCalled()
    })
  })

  describe('a decided draft', () => {
    it('cannot be deleted by its sender', async () => {
      const { draftId, mediaIds } = await ownDraft('decided', 2)
      await reject(draftId)
      const before = await readDraft(draftId)

      expect(await deleteExpenseDraftAction(draftId)).toEqual({
        success: false,
        error: pl.notices.draftAlreadyDecided,
        messageKey: 'draftAlreadyDecided',
      })

      expect(await readDraft(draftId)).toEqual(before)
      expect(await readPages(draftId)).toEqual(mediaIds)
    })
  })

  describe('his own pending draft', () => {
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
    it('is asked for once a draft is sent', async () => {
      const result = await sendExpenseDraftAction({
        investmentId,
        cashRegisterId: registerId,
        note: '',
        mediaIds: [await insertMedia('read-send', workerId)],
      })

      expect(result).toMatchObject({ success: true })
      expect(scheduled).toHaveLength(1)
    })
  })

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
