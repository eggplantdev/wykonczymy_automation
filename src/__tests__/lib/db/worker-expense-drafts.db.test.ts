import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { sqlList } from '@/lib/db/sql-list'
import {
  countPendingExpenseDrafts,
  decideExpenseDraft,
  deletePendingExpenseDraft,
  findDraftHeldMedia,
  insertWorkerExpenseDraft,
  listDraftTransferIds,
  listExpenseDraftFilterOptions,
  listExpenseDraftHistory,
  listPendingExpenseDrafts,
  listWorkerExpenseDrafts,
  restoreRejectedExpenseDraft,
  restoreSkippedReceipt,
  type ExpenseDraftFiltersT,
  type ExpenseDraftRowT,
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
    decideExpenseDraft(db, { draftId, decidedBy: workerId, status: 'rejected', transferIds: [] })

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

  // A transaction belongs to at most one zgłoszenie, so a fixture takes ones no earlier run linked.
  async function unlinkedTransferIds(count: number): Promise<number[]> {
    const { rows } = await db.execute(sql`
      SELECT id FROM transactions
      WHERE investment_id IS NOT NULL
        AND id NOT IN (SELECT transfer_id FROM worker_expense_draft_transfers)
      ORDER BY id LIMIT ${count}
    `)
    return rows.map((row) => Number(row.id))
  }

  // One zgłoszenie accepted as several transakcje: the badge marks every one of them, and only
  // those — a rejected draft has none.
  it('marks every transaction an accepted draft was booked as', async () => {
    const accepted = await draftOf([await insertMedia('listed-accepted', workerId)])
    const rejected = await draftOf([await insertMedia('listed-rejected', workerId)])
    if (accepted === null || rejected === null) throw new Error('draft fixture refused')
    const [first, second, unrelated] = await unlinkedTransferIds(3)

    await decideExpenseDraft(db, {
      draftId: accepted,
      decidedBy: workerId,
      status: 'accepted',
      transferIds: [first, second],
    })
    await reject(rejected)

    expect(await listDraftTransferIds(db, [first, second, unrelated])).toEqual([first, second])
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
    let acceptedPages: number[]
    let oneTransferId: number
    let oneTransferPages: number[]
    let unbookedId: number
    let unbookedPages: number[]
    let olderPendingId: number
    let newerPendingId: number
    let refusedOnlyId: number
    let transfers: { id: number; amount: number; investmentId: number; cancelled: boolean }[]

    const sentOn = (draftId: number, day: string) =>
      db.execute(
        sql`UPDATE worker_expense_drafts SET sent_at = ${day}::timestamptz WHERE id = ${draftId}`,
      )

    async function pendingDraftOn(name: string, onInvestment: number): Promise<number> {
      const draftId = await draftOf([await insertMedia(name, workerId)], onInvestment)
      if (draftId === null) throw new Error('draft fixture refused')
      return draftId
    }

    async function multiPageDraft(name: string, pageCount: number) {
      const pages: number[] = []
      for (let i = 0; i < pageCount; i++) pages.push(await insertMedia(`${name}-${i}`, workerId))
      const draftId = await draftOf(pages, historyInvestmentId)
      if (draftId === null) throw new Error('draft fixture refused')
      return { draftId, pages }
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
        SELECT id, amount, investment_id, cancelled FROM transactions
        WHERE id IN (${sqlList(await unlinkedTransferIds(3))})
        ORDER BY id
      `)
      transfers = rows.map((row) => ({
        id: Number(row.id),
        amount: Number(row.amount),
        investmentId: Number(row.investment_id),
        cancelled: row.cancelled === true,
      }))

      rejectedId = await pendingDraftOn('history-rejected', historyInvestmentId)
      ;({ draftId: acceptedId, pages: acceptedPages } = await multiPageDraft('history-accepted', 3))
      ;({ draftId: oneTransferId, pages: oneTransferPages } = await multiPageDraft(
        'history-one-transfer',
        2,
      ))
      ;({ draftId: unbookedId, pages: unbookedPages } = await multiPageDraft('history-unbooked', 2))
      olderPendingId = await pendingDraftOn('history-pending-old', historyInvestmentId)
      newerPendingId = await pendingDraftOn('history-pending-new', historyInvestmentId)
      refusedOnlyId = await pendingDraftOn('history-refused-only', refusedOnlyInvestmentId)
      await sentOn(rejectedId, '2026-01-01 10:00+01')
      await sentOn(olderPendingId, '2026-01-02 10:00+01')
      await sentOn(acceptedId, '2026-01-03 10:00+01')
      await sentOn(newerPendingId, '2026-01-04 10:00+01')
      await sentOn(oneTransferId, '2026-01-05 10:00+01')
      await sentOn(unbookedId, '2026-01-06 10:00+01')
      await reject(rejectedId)
      await reject(refusedOnlyId)
      await decideExpenseDraft(db, {
        draftId: acceptedId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferIds: [transfers[0].id, transfers[1].id],
        transferMediaIds: [[acceptedPages[0]], [acceptedPages[1]]],
        skippedReceipts: [{ mediaIds: [acceptedPages[2]] }],
      })
      // Booked from its first page only, but as the zgłoszenie's one row it shows both.
      await decideExpenseDraft(db, {
        draftId: oneTransferId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferIds: [transfers[2].id],
        transferMediaIds: [[oneTransferPages[0]]],
      })
      // Its transakcja since deleted: the link cascaded away, the skipped paragon stays.
      await decideExpenseDraft(db, {
        draftId: unbookedId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferIds: [],
        skippedReceipts: [{ mediaIds: [unbookedPages[1]] }],
      })
    })

    const pageIds = (row: ExpenseDraftRowT) => row.media.map((page) => page.id)

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
      expect(await historyIds()).toEqual([
        newerPendingId,
        olderPendingId,
        unbookedId,
        unbookedId,
        oneTransferId,
        acceptedId,
        acceptedId,
        acceptedId,
        rejectedId,
      ])
    })

    it('an unknown sort keeps the queue order', async () => {
      expect(await historyIds({}, 1, 50, '-transferAmount')).toEqual(await historyIds())
    })

    it('a column sort overrides the queue', async () => {
      expect(await historyIds({}, 1, 50, '-sentAt')).toEqual([
        unbookedId,
        unbookedId,
        oneTransferId,
        newerPendingId,
        acceptedId,
        acceptedId,
        acceptedId,
        olderPendingId,
        rejectedId,
      ])
    })

    it('filters and pages, counting every matching row', async () => {
      expect(await history({ statuses: ['pending'] })).toMatchObject({ totalDocs: 2 })
      expect(await historyIds({ statuses: ['pending'] })).toEqual([newerPendingId, olderPendingId])

      // Counted and paged per paragon row, not per zgłoszenie.
      const thirdPage = await history({}, 3, 2)
      expect(thirdPage.totalDocs).toBe(9)
      expect(thirdPage.rows.map((draft) => draft.id)).toEqual([oneTransferId, acceptedId])

      expect(await history({ workerIds: [otherWorkerId] })).toEqual({ rows: [], totalDocs: 0 })
      expect(await historyIds({ sentRange: { from: '2026-01-03', to: '2026-01-03' } })).toEqual([
        acceptedId,
        acceptedId,
        acceptedId,
      ])
    })

    it('offers every party with a listed draft, whatever the URL filters', async () => {
      const options = await listExpenseDraftFilterOptions(db)
      expect(options.investments.map((item) => item.id)).toContain(historyInvestmentId)
      expect(options.workers).toContainEqual({ id: workerId, name: 'Drafts A' })
    })

    // Linking by the draft's investment would open a list the booked transaction is not on.
    it('reads the decider and every booked transaction off the transactions', async () => {
      const accepted = (await history({ statuses: ['accepted'] })).rows.filter(
        (row) => row.id === acceptedId,
      )
      expect(accepted.map((row) => row.decidedByName)).toEqual(['Drafts B', 'Drafts B'])
      expect(accepted.flatMap((row) => row.transfers)).toEqual(transfers.slice(0, 2))
      expect(transfers[0].investmentId).not.toBe(historyInvestmentId)
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
        expect(new Set(await historyIds({ statuses: ['accepted'] }))).toEqual(
          new Set([unbookedId, oneTransferId, acceptedId]),
        )
        expect((await listWorkerExpenseDrafts(db, workerId)).map((draft) => draft.id)).toContain(
          acceptedId,
        )
      } finally {
        await setTrashed('investments', historyInvestmentId, false)
      }
    })

    // The status filter reads each paragon's own badge, so „odrzucony” catches a skipped one.
    it('filters by the paragon row, each with only its own pages', async () => {
      const rejected = await history({ statuses: ['rejected'] })
      expect(rejected.totalDocs).toBe(3)
      expect(
        rejected.rows.map((row) => [row.id, row.skippedReceipt !== undefined, pageIds(row)]),
      ).toEqual([
        [unbookedId, true, [unbookedPages[1]]],
        [acceptedId, true, [acceptedPages[2]]],
        [rejectedId, false, expect.any(Array)],
      ])

      const accepted = await history({ statuses: ['accepted'] })
      expect(accepted.totalDocs).toBe(4)
      expect(accepted.rows.some((row) => row.skippedReceipt)).toBe(false)
      expect(accepted.rows.filter((row) => row.id === acceptedId).map(pageIds)).toEqual([
        [acceptedPages[0]],
        [acceptedPages[1]],
      ])
    })

    it('a zgłoszenie that lists as one row shows all its pages', async () => {
      const rows = (await history()).rows
      expect(rows.filter((row) => row.id === oneTransferId).map(pageIds)).toEqual([
        oneTransferPages,
      ])
      expect(
        rows.filter((row) => row.id === unbookedId).map((row) => [row.status, pageIds(row)]),
      ).toEqual([
        ['accepted', unbookedPages],
        ['rejected', [unbookedPages[1]]],
      ])
    })

    it('a status sort puts skipped paragony in the „odrzucony” block', async () => {
      expect((await history({}, 1, 50, 'status')).rows.map((row) => row.status)).toEqual([
        ...Array(2).fill('pending'),
        ...Array(4).fill('accepted'),
        ...Array(3).fill('rejected'),
      ])
    })

    it('the worker list carries the same paragon rows', async () => {
      const listed = new Set([acceptedId, oneTransferId, unbookedId, rejectedId])
      const workerRows = (await listWorkerExpenseDrafts(db, workerId)).filter((row) =>
        listed.has(row.id),
      )
      const historyRows = (await history()).rows.filter((row) => listed.has(row.id))
      expect(workerRows).toEqual(historyRows)
    })

    it('the badge counts exactly the drafts the pending block lists', async () => {
      expect(await countPendingExpenseDrafts(db)).toBe((await listPendingExpenseDrafts(db)).length)
    })
  })

  describe('restoring a skipped paragon', () => {
    let restoreInvestmentId: number
    let parentId: number
    let pages: number[]
    let transferId: number
    const SENT_AT = '2026-02-01 10:00+01'

    const skippedOf = async (draftId: number) =>
      (
        await db.execute(sql`
          SELECT id, media_ids FROM worker_expense_draft_skipped_receipts
          WHERE draft_id = ${draftId} ORDER BY id
        `)
      ).rows.map((row) => ({
        id: Number(row.id),
        mediaIds: (row.media_ids as number[]).map(Number),
      }))

    const draftRow = async (draftId: number) =>
      (
        await db.execute(sql`
          SELECT worker_id, investment_id, cash_register_id, note, scan_mode, status,
            sent_at = ${SENT_AT}::timestamptz AS has_parent_sent_at, ai_read,
            ARRAY(SELECT media_id FROM worker_expense_draft_media
              WHERE draft_id = d.id ORDER BY position) AS pages,
            ARRAY(SELECT transfer_id FROM worker_expense_draft_transfers
              WHERE draft_id = d.id) AS transfers
          FROM worker_expense_drafts d WHERE id = ${draftId}
        `)
      ).rows[0]

    const setTrashedRegister = (isTrashed: boolean) =>
      db.execute(sql`
        UPDATE cash_registers SET trashed_at = ${isTrashed ? sql`now()` : sql`NULL`}
        WHERE id = ${registerId}
      `)

    // Booked from page 0; page 1 skipped alone; pages 3 and 2 skipped as one paragon. Only page 1
    // and the pair have a read row — the pair's written in another order than the skip.
    beforeAll(async () => {
      restoreInvestmentId = await createTestInvestment(payload, 'worker-expense-drafts-db-restore')
      pages = []
      for (let i = 0; i < 5; i++) pages.push(await insertMedia(`restore-${i}`, workerId))
      const draftId = await insertWorkerExpenseDraft(db, {
        workerId,
        investmentId: restoreInvestmentId,
        cashRegisterId: registerId,
        note: 'z budowy',
        scanMode: 'one-per-photo',
        mediaIds: pages,
      })
      if (draftId === null) throw new Error('draft fixture refused')
      parentId = draftId
      const aiRead = {
        rows: [
          { mediaIds: [pages[0]], amount: 10 },
          { mediaIds: [pages[1]], amount: 20, description: 'farba' },
          { mediaIds: [pages[2], pages[3]], amount: 30 },
        ],
      }
      await db.execute(sql`
        UPDATE worker_expense_drafts
        SET sent_at = ${SENT_AT}::timestamptz, ai_read = ${JSON.stringify(aiRead)}::jsonb
        WHERE id = ${parentId}
      `)
      ;[transferId] = await unlinkedTransferIds(1)
      await decideExpenseDraft(db, {
        draftId: parentId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferIds: [transferId],
        transferMediaIds: [[pages[0]]],
        skippedReceipts: [
          { mediaIds: [pages[1]] },
          { mediaIds: [pages[3], pages[2]] },
          { mediaIds: [pages[4]] },
        ],
      })
    })

    afterAll(async () => {
      await db.execute(
        sql`DELETE FROM worker_expense_drafts WHERE investment_id = ${restoreInvestmentId}`,
      )
      if (restoreInvestmentId)
        await deleteTestInvestment(payload, restoreInvestmentId).catch(() => {})
    })

    it('becomes a pending zgłoszenie of its own, carrying its read, and leaves the parent as booked', async () => {
      const [single] = await skippedOf(parentId)
      const restored = await restoreSkippedReceipt(db, single.id)
      if (!restored) throw new Error('restore refused')

      expect(restored.hasRead).toBe(true)
      expect(await draftRow(restored.draftId)).toEqual({
        worker_id: workerId,
        investment_id: restoreInvestmentId,
        cash_register_id: registerId,
        note: 'z budowy',
        scan_mode: 'one-per-photo',
        status: 'pending',
        has_parent_sent_at: true,
        ai_read: { rows: [{ mediaIds: [pages[1]], amount: 20, description: 'farba' }] },
        pages: [pages[1]],
        transfers: [],
      })
      expect((await skippedOf(parentId)).map((receipt) => receipt.id)).not.toContain(single.id)
      expect(await draftRow(parentId)).toMatchObject({
        status: 'accepted',
        pages,
        transfers: [transferId],
      })

      expect(await restoreSkippedReceipt(db, single.id)).toBeNull()
    })

    it('matches its read row as a set and keeps the parent’s page order', async () => {
      const pair = (await skippedOf(parentId)).find((receipt) => receipt.mediaIds.length === 2)
      if (!pair) throw new Error('pair fixture missing')
      const restored = await restoreSkippedReceipt(db, pair.id)
      if (!restored) throw new Error('restore refused')

      expect(restored.hasRead).toBe(true)
      expect(await draftRow(restored.draftId)).toMatchObject({
        ai_read: { rows: [{ mediaIds: [pages[2], pages[3]], amount: 30 }] },
        pages: [pages[2], pages[3]],
      })
    })

    // Deleting the restored zgłoszenie drops its links only; the accepted parent still holds the photo.
    it('a paragon with no read row comes back unread, and its pages outlive its delete', async () => {
      const unread = (await skippedOf(parentId)).find((receipt) => receipt.mediaIds[0] === pages[4])
      if (!unread) throw new Error('unread fixture missing')

      await setTrashedRegister(true)
      try {
        expect(await restoreSkippedReceipt(db, unread.id)).toBeNull()
        const listed = await listExpenseDraftHistory(
          db,
          {
            statuses: ['rejected'],
            investmentIds: [restoreInvestmentId],
            workerIds: null,
            sentRange: {},
          },
          { page: 1, limit: 50 },
        )
        expect(listed.rows.map((row) => row.skippedReceipt)).toEqual([
          { id: unread.id, isRestorable: false },
        ])
      } finally {
        await setTrashedRegister(false)
      }

      const restored = await restoreSkippedReceipt(db, unread.id)
      if (!restored) throw new Error('restore refused')
      expect(restored.hasRead).toBe(false)
      expect((await draftRow(restored.draftId)).ai_read).toBeNull()

      expect(await deletePendingExpenseDraft(db, { draftId: restored.draftId, workerId })).toEqual([
        pages[4],
      ])
      expect(await findDraftHeldMedia(db, [pages[4]])).toEqual([pages[4]])
    })
  })

  // EX-1025: the mark is management's record of why; the worker still reads a plain refusal.
  describe('a duplicate mark', () => {
    let duplicateInvestmentId: number

    const duplicatesOnly = () =>
      listExpenseDraftHistory(
        db,
        {
          statuses: null,
          investmentIds: [duplicateInvestmentId],
          workerIds: null,
          sentRange: {},
          duplicatesOnly: true,
        },
        { page: 1, limit: 50 },
      )

    beforeAll(async () => {
      duplicateInvestmentId = await createTestInvestment(payload, 'worker-expense-drafts-db-dup')
    })

    afterAll(async () => {
      await db.execute(
        sql`DELETE FROM worker_expense_drafts WHERE investment_id = ${duplicateInvestmentId}`,
      )
      if (duplicateInvestmentId)
        await deleteTestInvestment(payload, duplicateInvestmentId).catch(() => {})
    })

    it('an acceptance keeps the mark on the paragon skipped as a duplicate, which the worker sees as refused', async () => {
      const pages: number[] = []
      for (let i = 0; i < 3; i++) pages.push(await insertMedia(`dup-accept-${i}`, workerId))
      const draftId = await draftOf(pages, duplicateInvestmentId)
      if (draftId === null) throw new Error('draft fixture refused')
      const [transferId] = await unlinkedTransferIds(1)
      const duplicateOf = { source: 'transaction' as const, id: 424242 }

      await decideExpenseDraft(db, {
        draftId,
        decidedBy: otherWorkerId,
        status: 'accepted',
        transferIds: [transferId],
        transferMediaIds: [[pages[0]]],
        skippedReceipts: [{ mediaIds: [pages[1]], duplicateOf }, { mediaIds: [pages[2]] }],
      })

      const { rows: persisted } = await db.execute(sql`
        SELECT media_ids, duplicate_of FROM worker_expense_draft_skipped_receipts
        WHERE draft_id = ${draftId} ORDER BY id
      `)
      expect(
        persisted.map((row) => [(row.media_ids as number[]).map(Number), row.duplicate_of]),
      ).toEqual([
        [[pages[1]], duplicateOf],
        [[pages[2]], null],
      ])

      const marked = (await duplicatesOnly()).rows.filter((row) => row.id === draftId)
      expect(
        marked.map((row) => [row.status, row.skippedReceipt !== undefined, row.duplicateOf]),
      ).toEqual([['rejected', true, duplicateOf]])

      const workerRows = (await listWorkerExpenseDrafts(db, workerId)).filter(
        (row) => row.id === draftId,
      )
      expect(workerRows.map((row) => [row.status, row.media.map((page) => page.id)])).toEqual([
        ['accepted', [pages[0]]],
        ['rejected', [pages[1]]],
        ['rejected', [pages[2]]],
      ])
    })

    it('a refusal as a duplicate marks the zgłoszenie, reads „odrzucone” to the worker, and a restore clears it', async () => {
      const draftId = await draftOf(
        [await insertMedia('dup-reject', workerId)],
        duplicateInvestmentId,
      )
      if (draftId === null) throw new Error('draft fixture refused')
      const duplicateOf = { source: 'draft' as const, id: 434343 }

      await decideExpenseDraft(db, {
        draftId,
        decidedBy: otherWorkerId,
        status: 'rejected',
        transferIds: [],
        duplicateOf,
      })

      const persisted = async () =>
        (
          await db.execute(
            sql`SELECT status, duplicate_of FROM worker_expense_drafts WHERE id = ${draftId}`,
          )
        ).rows[0]
      expect(await persisted()).toEqual({ status: 'rejected', duplicate_of: duplicateOf })
      expect(
        (await listWorkerExpenseDrafts(db, workerId))
          .filter((row) => row.id === draftId)
          .map((row) => row.status),
      ).toEqual(['rejected'])
      expect((await duplicatesOnly()).rows.map((row) => row.id)).toContain(draftId)

      expect(await restoreRejectedExpenseDraft(db, draftId)).toBe(true)
      expect(await persisted()).toEqual({ status: 'pending', duplicate_of: null })
      expect((await duplicatesOnly()).rows.map((row) => row.id)).not.toContain(draftId)
    })
  })
})
