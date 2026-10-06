import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  decideExpenseDraft,
  insertWorkerExpenseDraft,
  listDraftTransferIds,
  listRejectedExpenseDrafts,
  restoreRejectedExpenseDraft,
  type RejectedDraftScopeT,
} from '@/lib/db/worker-expense-drafts'
import { cashRegisterDeleteBlocker } from '@/lib/cash-registers/delete-blocker'
import { investmentDeleteBlocker } from '@/lib/investments/delete-blocker'
import { workerUseBlocker } from '@/lib/workers/delete-blocker'
import { deleteUnreferencedMedia } from '@/lib/media/delete-unreferenced-media'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-971-draft-'

describe.skipIf(!ENV_READY)('worker expense draft media (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let workerId: number
  let registerId: number
  let otherWorkerId: number
  let otherRegisterId: number

  const ctx = { context: { skipRevalidation: true } }

  const purgeMedia = () =>
    db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)

  // Raw INSERT: an upload through Payload would push bytes at the Blob store for a fixture nothing opens.
  async function insertMedia(name: string, uploadedBy: number): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, created_by_id)
      VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${uploadedBy})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  const mediaExists = async (id: number) =>
    (await db.execute(sql`SELECT 1 FROM media WHERE id = ${id}`)).rows.length > 0

  const draftCount = async () =>
    Number(
      (
        await db.execute(
          sql`SELECT count(*)::int AS total FROM worker_expense_drafts WHERE worker_id = ${workerId}`,
        )
      ).rows[0].total,
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeMedia()
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'worker-expense-drafts-db-test')
    otherInvestmentId = await createTestInvestment(payload, 'worker-expense-drafts-db-test-other')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Drafts A', email: 'worker-expense-drafts-a@test.local', registerName: 'Kasa A' },
      ctx,
    ))
    ;({ ownerId: otherWorkerId, registerId: otherRegisterId } = await createRegisterOwner(
      payload,
      { name: 'Drafts B', email: 'worker-expense-drafts-b@test.local', registerName: 'Kasa B' },
      ctx,
    ))
  })

  afterAll(async () => {
    // A pending draft blocks its investment's delete, so the drafts go first or the investments leak.
    await db.execute(
      sql`DELETE FROM worker_expense_drafts WHERE worker_id IN (${workerId}, ${otherWorkerId})`,
    )
    await purgeMedia()
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    if (otherInvestmentId) await deleteTestInvestment(payload, otherInvestmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  const draftOf = (mediaIds: number[], onInvestment = investmentId) =>
    insertWorkerExpenseDraft(db, {
      workerId,
      investmentId: onInvestment,
      cashRegisterId: registerId,
      note: null,
      scanMode: 'one-invoice',
      mediaIds,
    })

  const reject = (draftId: number) =>
    decideExpenseDraft(db, { draftId, decidedBy: workerId, status: 'rejected', transferId: null })

  async function rejectedDraftOf(name: string, onInvestment = investmentId): Promise<number> {
    const draftId = await draftOf([await insertMedia(name, workerId)], onInvestment)
    if (draftId === null) throw new Error('draft fixture refused')
    await reject(draftId)
    return draftId
  }

  // The pages sit in a raw table the Payload-relation scan cannot see; without the extra probe a
  // waiting receipt reads as an orphan and the reclaim deletes it before a manager ever opens it.
  it('the reclaim leaves a page a draft holds', async () => {
    const page = await insertMedia('held', workerId)
    expect(await draftOf([page])).not.toBeNull()

    // Asserted on the attempt, not on the row: the delete guard would also save the row, and
    // would hide a reclaim that no longer sees the draft.
    const deleteSpy = vi.spyOn(payload, 'delete')
    await deleteUnreferencedMedia(payload, [page])

    expect(deleteSpy).not.toHaveBeenCalled()
    deleteSpy.mockRestore()
    expect(await mediaExists(page)).toBe(true)
  })

  it('the delete guard refuses a page a draft holds', async () => {
    const page = await insertMedia('guarded', workerId)
    expect(await draftOf([page])).not.toBeNull()

    await expect(
      payload.delete({ collection: 'media', id: page, overrideAccess: true }),
    ).rejects.toThrow(/zgłoszenia wydatków: 1/)
    expect(await mediaExists(page)).toBe(true)
  })

  // A guessed media id must not pull someone else's invoice into the worker's draft — and the
  // refusal must leave no half-written draft behind.
  it('refuses a draft carrying a page another user uploaded', async () => {
    const own = await insertMedia('own', workerId)
    const foreign = await insertMedia('foreign', otherWorkerId)
    const before = await draftCount()

    expect(await draftOf([own, foreign])).toBeNull()
    expect(await draftCount()).toBe(before)
  })

  // The badge and the filter read only accepted drafts: a rejected or pending one has no expense.
  it('lists the expense of an accepted draft only', async () => {
    const accepted = await draftOf([await insertMedia('listed-accepted', workerId)])
    const rejected = await draftOf([await insertMedia('listed-rejected', workerId)])
    if (accepted === null || rejected === null) throw new Error('draft fixture refused')
    const { rows } = await db.execute(sql`SELECT id FROM transactions ORDER BY id LIMIT 1`)
    const transferId = Number(rows[0].id)

    await decideExpenseDraft(db, {
      draftId: accepted,
      decidedBy: workerId,
      status: 'accepted',
      transferId,
    })
    await reject(rejected)

    expect(await listDraftTransferIds(db, [transferId])).toEqual([transferId])
    expect(await listDraftTransferIds(db)).toContain(transferId)
    expect(await listDraftTransferIds(db, [])).toEqual([])
  })

  // „Zgłoszone wydatki" lists the refused drafts above the transfers, so the URL's inwestycja / kasa
  // / dates must narrow them too — a manager filtering one investment must not see another's refusal.
  describe('refused drafts under the transfers filters', () => {
    let onInvestment: number
    let onOtherInvestment: number

    beforeAll(async () => {
      onInvestment = await rejectedDraftOf('scope-a')
      onOtherInvestment = await rejectedDraftOf('scope-b', otherInvestmentId)
      // 23:30 UTC is already the next day in Warsaw — the day the worker saw when he sent it.
      await db.execute(sql`
        UPDATE worker_expense_drafts SET sent_at = '2026-03-09 23:30:00+00' WHERE id = ${onInvestment}
      `)
    })

    const listedIds = async (scope: Partial<RejectedDraftScopeT>) =>
      (
        await listRejectedExpenseDrafts(db, 10_000, {
          investmentIds: null,
          registerIds: null,
          sentRange: {},
          ...scope,
        })
      )
        .map((draft) => draft.id)
        .filter((id) => id === onInvestment || id === onOtherInvestment)

    it('an empty scope lists both', async () => {
      expect(await listedIds({})).toEqual(expect.arrayContaining([onInvestment, onOtherInvestment]))
    })

    it('narrows by inwestycja', async () => {
      expect(await listedIds({ investmentIds: [investmentId] })).toEqual([onInvestment])
    })

    it('narrows by kasa', async () => {
      expect(await listedIds({ registerIds: [otherRegisterId] })).toEqual([])
      expect(await listedIds({ registerIds: [registerId] })).toHaveLength(2)
    })

    it('a filter that named nothing valid lists none', async () => {
      expect(await listedIds({ investmentIds: [] })).toEqual([])
    })

    it('narrows by the Warsaw day it was sent', async () => {
      const day = { from: '2026-03-10', to: '2026-03-10' }
      expect(await listedIds({ sentRange: day })).toEqual([onInvestment])
    })
  })

  // A pending draft is a receipt the worker is owed money for; deleting its worker, investment or
  // kasa would CASCADE it away before a manager decided it.
  it('a pending draft blocks the delete until a manager decides it', async () => {
    const pendingLabel = /zgłoszenia wydatków do rozpatrzenia/
    const draftId = await draftOf([await insertMedia('blocks', workerId)], otherInvestmentId)
    if (draftId === null) throw new Error('draft fixture refused')

    expect(await workerUseBlocker(payload, workerId)).toMatch(pendingLabel)
    expect(await investmentDeleteBlocker(payload, otherInvestmentId)).toMatch(pendingLabel)
    expect(await cashRegisterDeleteBlocker(payload, registerId)).toMatch(pendingLabel)

    const { rows } = await db.execute(sql`
      SELECT id FROM worker_expense_drafts WHERE worker_id = ${workerId} AND status = 'pending'
    `)
    for (const row of rows) await reject(Number(row.id))

    expect((await workerUseBlocker(payload, workerId)) ?? '').not.toMatch(pendingLabel)
    expect((await investmentDeleteBlocker(payload, otherInvestmentId)) ?? '').not.toMatch(
      pendingLabel,
    )
    expect((await cashRegisterDeleteBlocker(payload, registerId)) ?? '').not.toMatch(pendingLabel)
  })

  // A refusal does not hold back the trash of its parties, so it can outlive any of them there;
  // re-opening it would hold back their purge and offer a kasa nobody can book into.
  it.each([
    ['pracownik', 'users', () => workerId],
    ['inwestycja', 'investments', () => investmentId],
    ['kasa', 'cash_registers', () => registerId],
  ])(
    'a refusal whose %s is in the trash is neither listed nor restored',
    async (_party, table, partyId) => {
      const draftId = await rejectedDraftOf(`trashed-${table}`)
      const setTrashed = (isTrashed: boolean) =>
        db.execute(sql`
        UPDATE ${sql.identifier(table)} SET trashed_at = ${isTrashed ? sql`now()` : sql`NULL`}
        WHERE id = ${partyId()}
      `)
      const statusOf = async () =>
        (await db.execute(sql`SELECT status FROM worker_expense_drafts WHERE id = ${draftId}`))
          .rows[0].status

      await setTrashed(true)
      try {
        const listed = await listRejectedExpenseDrafts(db, 10_000, {
          investmentIds: null,
          registerIds: null,
          sentRange: {},
        })
        expect(listed.map((draft) => draft.id)).not.toContain(draftId)
        expect(await restoreRejectedExpenseDraft(db, draftId)).toBe(false)
        expect(await statusOf()).toBe('rejected')
      } finally {
        await setTrashed(false)
      }

      expect(await restoreRejectedExpenseDraft(db, draftId)).toBe(true)
      expect(await statusOf()).toBe('pending')
    },
  )
})
