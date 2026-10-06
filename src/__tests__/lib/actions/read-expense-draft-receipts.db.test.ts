import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { UNREADABLE_RECEIPT, type ReceiptExtractionT } from '@/lib/ai/receipt-extraction-schema'
import { getDb } from '@/lib/db/get-db'
import {
  decideExpenseDraft,
  insertWorkerExpenseDraft,
  removeExpenseDraftPage,
  updatePendingExpenseDraft,
} from '@/lib/db/worker-expense-drafts'
import type { ScanModeT } from '@/lib/constants/receipt-scan'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
const { extractReceipt } = vi.hoisted(() => ({ extractReceipt: vi.fn() }))
vi.mock('@/lib/ai/openrouter', () => ({ extractReceipt }))
const { fetchMediaBytes } = vi.hoisted(() => ({ fetchMediaBytes: vi.fn() }))
vi.mock('@/lib/media/blob-public-url', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media/blob-public-url')>()),
  fetchMediaBytes,
}))

const { readExpenseDraftReceipts } = await import('@/lib/actions/read-expense-draft-receipts')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-1001-read-'

const reading = (overrides: Partial<ReceiptExtractionT> = {}): ReceiptExtractionT => ({
  description: 'Leroy Merlin 11.07.2026',
  amount: 123,
  netAmount: 100,
  invoiceNote: 'FV 1/2026',
  otherCategoryName: '',
  ...overrides,
})

describe.skipIf(!ENV_READY)('readExpenseDraftReceipts (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number

  async function createDraft(name: string, pageCount: number, scanMode: ScanModeT) {
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
      scanMode,
      mediaIds,
    })
    if (draftId === null) throw new Error('draft fixture refused')
    return { draftId, mediaIds }
  }

  const readOf = async (draftId: number) =>
    (await db.execute(sql`SELECT ai_read FROM worker_expense_drafts WHERE id = ${draftId}`)).rows[0]
      .ai_read

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
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
    fetchMediaBytes
      .mockReset()
      .mockImplementation(async (_store: string, media: { filename: string; mimeType: string }) => ({
        bytes: new Uint8Array([1]),
        mediaType: media.mimeType,
        filename: media.filename,
      }))
  })

  afterAll(async () => {
    vi.unstubAllEnvs()
    await db.execute(sql`DELETE FROM worker_expense_drafts WHERE worker_id = ${workerId}`)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('„Jeden wydatek” stores one row over every page, read in one call', async () => {
    const { draftId, mediaIds } = await createDraft('one-invoice', 2, 'one-invoice')

    await readExpenseDraftReceipts(db, draftId)

    expect(extractReceipt).toHaveBeenCalledTimes(1)
    expect(extractReceipt.mock.calls[0][0]).toHaveLength(2)
    expect(await readOf(draftId)).toEqual({
      rows: [
        {
          mediaIds,
          description: 'Leroy Merlin 11.07.2026',
          amount: 123,
          netAmount: 100,
          invoiceNote: 'FV 1/2026',
          filename: 'leroy-merlin-11-07-2026.jpg',
        },
      ],
    })
  })

  it('„Kilka wydatków” stores one row per photo; an unreadable or unfetched one stays bare', async () => {
    const { draftId, mediaIds } = await createDraft('per-photo', 3, 'one-per-photo')
    extractReceipt.mockImplementation(async (pages: { filename: string }[]) =>
      pages[0].filename.endsWith('-1.jpg')
        ? reading({ description: UNREADABLE_RECEIPT, amount: null, netAmount: null })
        : reading({ description: 'Castorama', netAmount: null, invoiceNote: '' }),
    )
    fetchMediaBytes.mockImplementationOnce(async () => {
      throw new Error('Blob 404')
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toEqual({
      rows: [
        { mediaIds: [mediaIds[0]] },
        { mediaIds: [mediaIds[1]] },
        {
          mediaIds: [mediaIds[2]],
          description: 'Castorama',
          amount: 123,
          filename: 'castorama.jpg',
        },
      ],
    })
  })

  it('writes nothing when no photo could be read', async () => {
    const { draftId } = await createDraft('all-failed', 2, 'one-per-photo')
    extractReceipt.mockResolvedValue(
      reading({ description: UNREADABLE_RECEIPT, amount: null, netAmount: null, invoiceNote: '' }),
    )

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toBeNull()
  })

  it('a photo removed while the AI reads loses the write — the draft keeps the clear', async () => {
    const { draftId, mediaIds } = await createDraft('stale-page', 2, 'one-invoice')
    extractReceipt.mockImplementation(async () => {
      await removeExpenseDraftPage(db, { draftId, workerId, mediaId: mediaIds[1] })
      return reading()
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toBeNull()
  })

  it('a mode changed while the AI reads loses the write', async () => {
    const { draftId } = await createDraft('stale-mode', 2, 'one-invoice')
    extractReceipt.mockImplementation(async () => {
      await updatePendingExpenseDraft(db, {
        draftId,
        workerId,
        investmentId,
        cashRegisterId: registerId,
        note: null,
        scanMode: 'one-per-photo',
      })
      return reading()
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toBeNull()
  })

  it('a draft decided while the AI reads is left as the record it became', async () => {
    const { draftId } = await createDraft('decided', 1, 'one-invoice')
    extractReceipt.mockImplementation(async () => {
      await decideExpenseDraft(db, {
        draftId,
        decidedBy: workerId,
        status: 'rejected',
        transferId: null,
      })
      return reading()
    })

    await readExpenseDraftReceipts(db, draftId)

    expect(await readOf(draftId)).toBeNull()
  })
})
