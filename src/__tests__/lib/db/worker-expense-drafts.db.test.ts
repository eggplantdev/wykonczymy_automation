import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  countPendingExpenseDrafts,
  decideExpenseDraft,
  insertWorkerExpenseDraft,
  listDraftTransferIds,
  listExpenseDraftFilterOptions,
  listExpenseDraftHistory,
  listPendingExpenseDrafts,
  listWorkerExpenseDrafts,
  restoreRejectedExpenseDraft,
  type ExpenseDraftFiltersT,
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
    ;({ ownerId: otherWorkerId } = await createRegisterOwner(
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
    expect(await listDraftTransferIds(db, [])).toEqual([])
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
        const { rows: listed } = await listExpenseDraftHistory(
          db,
          { statuses: ['rejected'], investmentIds: null, workerIds: [workerId], sentRange: {} },
          { page: 1, limit: 10_000 },
        )
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

  describe('the draft history', () => {
    let historyInvestmentId: number
    let refusedOnlyInvestmentId: number
    let rejectedId: number
    let acceptedId: number
    let olderPendingId: number
    let newerPendingId: number
    let refusedOnlyId: number
    let transfer: { id: number; amount: number; investmentId: number }

    const sentOn = (draftId: number, day: string) =>
      db.execute(
        sql`UPDATE worker_expense_drafts SET sent_at = ${day}::timestamptz WHERE id = ${draftId}`,
      )

    async function pendingDraftOn(name: string, onInvestment: number): Promise<number> {
      const draftId = await draftOf([await insertMedia(name, workerId)], onInvestment)
      if (draftId === null) throw new Error('draft fixture refused')
      return draftId
    }

    const NO_FILTERS: ExpenseDraftFiltersT = {
      statuses: null,
      investmentIds: null,
      workerIds: null,
      sentRange: {},
    }

    const history = (
      filters: Partial<ExpenseDraftFiltersT> = {},
      page = 1,
      limit = 50,
      sort?: string,
    ) =>
      listExpenseDraftHistory(
        db,
        { ...NO_FILTERS, investmentIds: [historyInvestmentId], ...filters },
        { page, limit },
        sort,
      )

    const historyIds = async (...args: Parameters<typeof history>) =>
      (await history(...args)).rows.map((draft) => draft.id)

    const setTrashed = (table: string, id: number, isTrashed: boolean) =>
      db.execute(sql`
        UPDATE ${sql.identifier(table)} SET trashed_at = ${isTrashed ? sql`now()` : sql`NULL`}
        WHERE id = ${id}
      `)

    beforeAll(async () => {
      historyInvestmentId = await createTestInvestment(payload, 'worker-expense-drafts-db-history')
      refusedOnlyInvestmentId = await createTestInvestment(
        payload,
        'worker-expense-drafts-db-refused-only',
      )
      const { rows } = await db.execute(sql`
        SELECT id, amount, investment_id FROM transactions WHERE investment_id IS NOT NULL
        ORDER BY id LIMIT 1
      `)
      transfer = {
        id: Number(rows[0].id),
        amount: Number(rows[0].amount),
        investmentId: Number(rows[0].investment_id),
      }

      rejectedId = await pendingDraftOn('history-rejected', historyInvestmentId)
      acceptedId = await pendingDraftOn('history-accepted', historyInvestmentId)
      olderPendingId = await pendingDraftOn('history-pending-old', historyInvestmentId)
      newerPendingId = await pendingDraftOn('history-pending-new', historyInvestmentId)
      refusedOnlyId = await pendingDraftOn('history-refused-only', refusedOnlyInvestmentId)
      await sentOn(rejectedId, '2026-01-01 10:00+01')
      await sentOn(olderPendingId, '2026-01-02 10:00+01')
      await sentOn(acceptedId, '2026-01-03 10:00+01')
      await sentOn(newerPendingId, '2026-01-04 10:00+01')
      await reject(rejectedId)
      await reject(refusedOnlyId)
      // The transaction belongs to another investment: the manager rebooked it while accepting.
      await decideExpenseDraft(db, {
        draftId: acceptedId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferId: transfer.id,
      })
    })

    afterAll(async () => {
      await db.execute(sql`
        DELETE FROM worker_expense_drafts
        WHERE investment_id IN (${historyInvestmentId}, ${refusedOnlyInvestmentId})
      `)
      if (historyInvestmentId)
        await deleteTestInvestment(payload, historyInvestmentId).catch(() => {})
      if (refusedOnlyInvestmentId)
        await deleteTestInvestment(payload, refusedOnlyInvestmentId).catch(() => {})
    })

    it('lists the pending queue first, then the rest newest first', async () => {
      expect(await historyIds()).toEqual([newerPendingId, olderPendingId, acceptedId, rejectedId])
    })

    it('an unknown sort keeps the queue order', async () => {
      expect(await historyIds({}, 1, 50, '-transferAmount')).toEqual(await historyIds())
    })

    it('a column sort overrides the queue', async () => {
      expect(await historyIds({}, 1, 50, '-sentAt')).toEqual([
        newerPendingId,
        acceptedId,
        olderPendingId,
        rejectedId,
      ])
    })

    it('filters and pages, counting every matching row', async () => {
      expect(await history({ statuses: ['pending'] })).toMatchObject({ totalDocs: 2 })
      expect(await historyIds({ statuses: ['pending'] })).toEqual([newerPendingId, olderPendingId])

      const secondPage = await history({}, 2, 2)
      expect(secondPage.totalDocs).toBe(4)
      expect(secondPage.rows.map((draft) => draft.id)).toEqual([acceptedId, rejectedId])

      expect(await history({ workerIds: [otherWorkerId] })).toEqual({ rows: [], totalDocs: 0 })
      expect(await historyIds({ sentRange: { from: '2026-01-03', to: '2026-01-03' } })).toEqual([
        acceptedId,
      ])
    })

    it('offers every party with a listed draft, whatever the URL filters', async () => {
      const options = await listExpenseDraftFilterOptions(db)
      expect(options.investments.map((item) => item.id)).toContain(historyInvestmentId)
      expect(options.workers).toContainEqual({ id: workerId, name: 'Drafts A' })
    })

    // Linking by the draft's investment would open a list the booked transaction is not on.
    it('reads the decider and the booked expense off the transaction', async () => {
      const accepted = (await history({ statuses: ['accepted'] })).rows[0]
      expect(accepted).toMatchObject({
        decidedByName: 'Drafts B',
        transferId: transfer.id,
        transferAmount: transfer.amount,
        transferInvestmentId: transfer.investmentId,
      })
      expect(transfer.investmentId).not.toBe(historyInvestmentId)
    })

    it('hides a refusal whose kasa is in the trash from the history, the facets and the worker', async () => {
      await setTrashed('cash_registers', registerId, true)
      try {
        const scoped = await listExpenseDraftHistory(
          db,
          { ...NO_FILTERS, investmentIds: [refusedOnlyInvestmentId] },
          { page: 1, limit: 50 },
        )
        expect(scoped).toEqual({ rows: [], totalDocs: 0 })
        const options = await listExpenseDraftFilterOptions(db)
        expect(options.investments.map((item) => item.id)).not.toContain(refusedOnlyInvestmentId)
        const workerIds = (await listWorkerExpenseDrafts(db, workerId)).map((draft) => draft.id)
        expect(workerIds).not.toContain(refusedOnlyId)
        expect(workerIds).toContain(acceptedId)
      } finally {
        await setTrashed('cash_registers', registerId, false)
      }
    })

    it('keeps an accepted draft listed after its investment went to the trash', async () => {
      await setTrashed('investments', historyInvestmentId, true)
      try {
        expect(await historyIds({ statuses: ['accepted'] })).toEqual([acceptedId])
        expect((await listWorkerExpenseDrafts(db, workerId)).map((draft) => draft.id)).toContain(
          acceptedId,
        )
      } finally {
        await setTrashed('investments', historyInvestmentId, false)
      }
    })

    it('the badge counts exactly the drafts the pending block lists', async () => {
      expect(await countPendingExpenseDrafts(db)).toBe((await listPendingExpenseDrafts(db)).length)
    })
  })
})
