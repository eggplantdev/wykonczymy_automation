import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  decideExpenseDraft,
  insertWorkerExpenseDraft,
  listDraftTransferIds,
} from '@/lib/db/worker-expense-drafts'
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
    await purgeMedia()
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  const draftOf = (mediaIds: number[]) =>
    insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId: registerId,
      note: null,
      mediaIds,
    })

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

    const decidedBy = workerId
    await decideExpenseDraft(db, { draftId: accepted, decidedBy, status: 'accepted', transferId })
    await decideExpenseDraft(db, {
      draftId: rejected,
      decidedBy,
      status: 'rejected',
      transferId: null,
    })

    expect(await listDraftTransferIds(db, [transferId])).toEqual([transferId])
    expect(await listDraftTransferIds(db)).toContain(transferId)
    expect(await listDraftTransferIds(db, [])).toEqual([])
  })
})
