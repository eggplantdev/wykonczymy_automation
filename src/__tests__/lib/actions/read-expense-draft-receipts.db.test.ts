import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { getDb } from '@/lib/db/get-db'
import { decideExpenseDraft, insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { extractReceipt, extractReceipts } = vi.hoisted(() => ({
  extractReceipt: vi.fn(),
  extractReceipts: vi.fn(),
}))
vi.mock('@/lib/ai/openrouter', () => ({ extractReceipt, extractReceipts }))
const { fetchMediaBytes } = vi.hoisted(() => ({ fetchMediaBytes: vi.fn() }))
vi.mock('@/lib/media/blob-public-url', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/blob-public-url')>()),
  fetchMediaBytes,
}))

const { readExpenseDraftReceipts } = await import('@/lib/actions/read-expense-draft-receipts')

const FILENAME_PREFIX = 'ex-1001-read-'

const reading = (overrides: Partial<ReceiptExtractionT> = {}): ReceiptExtractionT => ({
  description: 'Leroy Merlin 11.07.2026',
  amount: 123,
  netAmount: 100,
  invoiceNote: 'FV 1/2026',
  otherCategoryName: '',
  documentNumber: '',
  sellerNip: '',
  documentDate: '',
  ...overrides,
})

describe.skipIf(!ENV_READY)('readExpenseDraftReceipts (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number

  async function createDraft(name: string, pageCount: number) {
    const mediaIds: number[] = []
    for (let page = 0; page < pageCount; page++) {
      const { rows } = await db.execute(sql`
        INSERT INTO media (filename, mime_type, filesize, created_by_id)
        VALUES (${`${FILENAME_PREFIX}${name}-${page}.jpg`}, 'image/jpeg', 1024, ${workerId})
        RETURNING id
      `)
      mediaIds.push(Number(rows[0].id))
    }
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId: registerId,
      note: null,
      mediaIds,
    })
    if (draftId === null) throw new Error('draft fixture refused')
    return { draftId, mediaIds }
  }

  const readOf = async (draftId: number) =>
    (await db.execute(sql`SELECT ai_read FROM worker_expense_drafts WHERE id = ${draftId}`)).rows[0]
      .ai_read

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    investmentId = await createTestInvestment(payload, 'worker-expense-read-db-test')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Read W', email: 'worker-expense-read-w@test.local', registerName: 'Kasa R' },
      { context: { skipRevalidation: true } },
    ))
  })

  beforeEach(() => {
    vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'vercel_blob_rw_testStore_secret')
    extractReceipt.mockReset().mockResolvedValue(reading())
    extractReceipts.mockReset().mockResolvedValue([reading()])
    fetchMediaBytes
      .mockReset()
      .mockImplementation(
        async (_store: string, media: { filename: string; mimeType: string }) => ({
          bytes: new Uint8Array([1]),
          mediaType: media.mimeType,
          filename: media.filename,
        }),
      )
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.execute(sql`DELETE FROM worker_expense_drafts WHERE worker_id = ${workerId}`)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('reads a multi-photo draft photo by photo, keeping the whole reading', async () => {
    const { draftId, mediaIds } = await createDraft('multi-photo', 2)

    await readExpenseDraftReceipts(db, draftId)

    expect(extractReceipt).not.toHaveBeenCalled()
    expect(extractReceipts).toHaveBeenCalledTimes(2)
    expect(extractReceipts.mock.calls.map(([pages]) => pages.length)).toEqual([1, 1])
    const row = {
      description: 'Leroy Merlin 11.07.2026',
      amount: 123,
      netAmount: 100,
      invoiceNote: 'FV 1/2026',
      filename: 'leroy-merlin-11-07-2026.jpg',
    }
    expect(await readOf(draftId)).toEqual({
      rows: [
        { mediaIds: [mediaIds[0]], ...row },
        { mediaIds: [mediaIds[1]], ...row },
      ],
    })
  })

  it('„Kilka wydatków” stores a row per paragon on each photo; an unreadable or unfetched photo keeps the sentinel', async () => {
    const { draftId, mediaIds } = await createDraft('per-photo', 3)
    extractReceipts.mockImplementation(async (pages: { filename: string }[]) =>
      pages[0].filename.endsWith('-1.jpg')
        ? []
        : [
            reading({ description: 'Castorama', netAmount: null, invoiceNote: '' }),
            reading({ description: 'Parking', amount: 5, netAmount: null, invoiceNote: '' }),
          ],
    )
    fetchMediaBytes.mockImplementationOnce(async () => {
      throw new Error('Blob 404')
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(extractReceipt).not.toHaveBeenCalled()
    expect(await readOf(draftId)).toEqual({
      rows: [
        { mediaIds: [mediaIds[0]], description: UNREADABLE_RECEIPT },
        { mediaIds: [mediaIds[1]], description: UNREADABLE_RECEIPT },
        {
          mediaIds: [mediaIds[2]],
          description: 'Castorama',
          amount: 123,
          filename: 'castorama.jpg',
        },
        { mediaIds: [mediaIds[2]], description: 'Parking', amount: 5, filename: 'parking.jpg' },
      ],
    })
  })

  // Stored, or every „Zobacz" would pay the model again for the same answer.
  it('stores a draft the AI could not read at all', async () => {
    const { draftId, mediaIds } = await createDraft('all-unreadable', 2)
    extractReceipts.mockResolvedValue([])

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toEqual({
      rows: [
        { mediaIds: [mediaIds[0]], description: UNREADABLE_RECEIPT },
        { mediaIds: [mediaIds[1]], description: UNREADABLE_RECEIPT },
      ],
    })
  })

  it('returns a stored read without asking the AI again', async () => {
    const { draftId } = await createDraft('already-read', 2)
    const stored = await readExpenseDraftReceipts(db, draftId)
    extractReceipts.mockClear()

    expect(await readExpenseDraftReceipts(db, draftId)).toEqual(stored)
    expect(extractReceipts).not.toHaveBeenCalled()
  })

  it('stores the sentinel per photo when no photo reached the AI', async () => {
    const { draftId, mediaIds } = await createDraft('all-unfetched', 2)
    fetchMediaBytes.mockRejectedValue(new Error('Blob 404'))

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toEqual({
      rows: [
        { mediaIds: [mediaIds[0]], description: UNREADABLE_RECEIPT },
        { mediaIds: [mediaIds[1]], description: UNREADABLE_RECEIPT },
      ],
    })
  })

  // A skipped paragon and a duplicate hint name their row by its position in the stored read, so a
  // second read („Zobacz" while the send-time one runs) must not swap it for a different one.
  it('the first read stored wins an overlapping one, and both callers get it', async () => {
    const { draftId, mediaIds } = await createDraft('overlap', 1)
    const first = { rows: [{ mediaIds, description: 'Castorama', amount: 10 }] }
    extractReceipts.mockImplementation(async () => {
      await db.execute(sql`
        UPDATE worker_expense_drafts SET ai_read = ${JSON.stringify(first)}::jsonb WHERE id = ${draftId}
      `)
      return [reading({ description: 'Leroy Merlin', amount: 20 })]
    })

    const returned = await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toEqual(first)
    expect(returned).toEqual(first)
  })

  it('a draft decided while the AI reads is left as the record it became', async () => {
    const { draftId } = await createDraft('decided', 1)
    extractReceipts.mockImplementation(async () => {
      await decideExpenseDraft(db, {
        draftId,
        decidedBy: workerId,
        status: 'rejected',
        transferIds: [],
      })
      return [reading()]
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toBeNull()
  })
})
