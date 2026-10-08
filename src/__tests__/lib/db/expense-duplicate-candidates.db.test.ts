import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  loadDraftCandidates,
  loadDraftProbes,
  loadTransactionCandidates,
  type CandidateT,
} from '@/lib/db/expense-duplicate-candidates'
import { insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import type { ExpenseDraftReadRowT } from '@/lib/db/expense-draft-read'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))

const { findExpenseDraftDuplicates } = await import('@/lib/queries/expense-draft-duplicates')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-1025-dup-'
// Odd enough that no booked row in the restored dump shares it.
const AMOUNT = 7391.23
const AMOUNT_CENTS = 739123
const NUMBER = 'FV1025/TST/77'
const LEGACY_NUMBER = 'FV1025/TST/88'

describe.skipIf(!ENV_READY)('expense duplicate candidates (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number
  let probeDraftId: number
  let otherDraftId: number
  let rejectedDraftId: number
  const tx: Record<string, number> = {}

  const ctx = { context: { skipRevalidation: true } }

  async function insertMedia(name: string): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (url, filename, mime_type, filesize, created_by_id)
      VALUES (${`https://blob.test/${FILENAME_PREFIX}${name}.jpg`}, ${`${FILENAME_PREFIX}${name}.jpg`},
        'image/jpeg', 1024, ${workerId})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  // Raw INSERT: the transfer hooks (sheet sync, revalidation) have nothing to do with what is read here.
  async function insertTransaction(
    key: string,
    row: {
      amount: number
      type?: string
      cancelled?: boolean
      description?: string
      documentNumber?: string
      documentDate?: string
      invoiceNote?: string
    },
  ) {
    const { rows } = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, source_register_id, investment_id,
        cancelled, invoice_note, document_number, document_date)
      VALUES (${row.description ?? `EX-1025 ${key}`}, ${row.amount}, '2026-10-06T12:00:00Z',
        ${row.type ?? 'INVESTMENT_EXPENSE'}, ${registerId}, ${investmentId}, ${row.cancelled ?? false},
        ${row.invoiceNote ?? null}, ${row.documentNumber ?? null}, ${row.documentDate ?? null})
      RETURNING id
    `)
    tx[key] = Number(rows[0].id)
  }

  async function pendingDraftWithRead(
    name: string,
    readRows: (Omit<ExpenseDraftReadRowT, 'mediaIds'> | null)[],
  ): Promise<{ draftId: number; pages: number[] }> {
    const pages: number[] = []
    for (let i = 0; i < readRows.length; i++) pages.push(await insertMedia(`${name}-${i}`))
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId: registerId,
      note: null,
      scanMode: 'one-per-photo',
      mediaIds: pages,
    })
    if (draftId === null) throw new Error('draft fixture refused')
    const aiRead = {
      rows: readRows.map((read, i) => ({ mediaIds: [pages[i]], ...read })),
    }
    await db.execute(sql`
      UPDATE worker_expense_drafts
      SET ai_read = ${JSON.stringify(aiRead)}::jsonb, sent_at = '2026-10-07T08:00:00Z'::timestamptz
      WHERE id = ${draftId}
    `)
    return { draftId, pages }
  }

  const cleanup = async () => {
    await db.execute(sql`
      DELETE FROM worker_expense_drafts
      WHERE worker_id IN (SELECT id FROM users WHERE email = 'expense-duplicates@test.local')
    `)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await cleanup()
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'expense-duplicate-candidates-db-test')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Dup Worker', email: 'expense-duplicates@test.local', registerName: 'Kasa Dup' },
      ctx,
    ))
    const managers = await payload.find({
      collection: 'users',
      where: { role: { equals: 'OWNER' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!managers.docs[0]) throw new Error('missing OWNER')
    authState.userId = Number(managers.docs[0].id)

    await insertTransaction('byAmount', {
      amount: AMOUNT,
      description: 'Castorama 06.10.2026',
      documentDate: '2026-10-06',
    })
    await insertTransaction('byNumber', { amount: 55, documentNumber: 'fv 1025/tst/77' })
    await insertTransaction('legacyNote', {
      amount: 66,
      invoiceNote: `  ${LEGACY_NUMBER}\nFarba biała`,
    })
    await insertTransaction('cancelled', { amount: AMOUNT, cancelled: true })
    await insertTransaction('notAReceipt', { amount: AMOUNT, type: 'INVESTOR_DEPOSIT' })
    await insertTransaction('unrelated', { amount: AMOUNT + 0.01, documentNumber: 'FV1025/TST/99' })
    ;({ draftId: probeDraftId } = await pendingDraftWithRead('probe', [
      { amount: AMOUNT, description: 'Castorama 06.10.2026', documentDate: '2026-10-06' },
      { documentNumber: 'FV 1025/TST/77' },
      { documentNumber: LEGACY_NUMBER },
    ]))
    ;({ draftId: otherDraftId } = await pendingDraftWithRead('other', [
      { amount: AMOUNT, description: 'Obi 05.10.2026' },
      { amount: AMOUNT, description: 'Obi 05.10.2026' },
      { amount: 12.34 },
    ]))
    ;({ draftId: rejectedDraftId } = await pendingDraftWithRead('rejected', [{ amount: AMOUNT }]))
    await db.execute(
      sql`UPDATE worker_expense_drafts SET status = 'rejected', decided_at = now() WHERE id = ${rejectedDraftId}`,
    )
  })

  afterAll(async () => {
    if (!db) return
    await cleanup()
    await db.execute(sql`DELETE FROM transactions WHERE source_register_id = ${registerId}`)
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  const FILTER = { amountsCents: [AMOUNT_CENTS], documentNumbers: [NUMBER, LEGACY_NUMBER] }
  const ourTransactionIds = (candidates: CandidateT[]) =>
    candidates.map((c) => c.id).filter((id) => Object.values(tx).includes(id))

  it('reads one probe per read row of the pending draft, in read order', async () => {
    const probes = await loadDraftProbes(db, probeDraftId)
    expect(probes.map((probe) => [probe.amount, probe.documentNumber])).toEqual([
      [AMOUNT, null],
      [null, 'FV 1025/TST/77'],
      [null, LEGACY_NUMBER],
    ])
    expect(await loadDraftProbes(db, rejectedDraftId)).toEqual([])
  })

  it('returns a booked receipt by amount, by number, and by „Notatka" line 1 — nothing else', async () => {
    const ids = ourTransactionIds(await loadTransactionCandidates(db, FILTER))
    expect(ids.sort((a, b) => a - b)).toEqual(
      [tx.byAmount, tx.byNumber, tx.legacyNote].sort((a, b) => a - b),
    )
  })

  it('returns each matching paragon of another pending zgłoszenie under its own key, never the probe’s own', async () => {
    const candidates = await loadDraftCandidates(db, { ...FILTER, excludeDraftId: probeDraftId })
    const ids = candidates.map((c) => c.id)
    expect(ids).not.toContain(probeDraftId)
    expect(ids).not.toContain(rejectedDraftId)

    const fromOther = candidates.filter((c) => c.id === otherDraftId)
    expect(fromOther.map((c) => c.key).sort()).toEqual([
      `draft-${otherDraftId}-1`,
      `draft-${otherDraftId}-2`,
    ])
    expect(fromOther.every((c) => c.submitterName === 'Dup Worker')).toBe(true)
    expect(fromOther.every((c) => c.pages.length === 1)).toBe(true)
  })

  it('the accept dialog’s check matches each probe paragon to its booked twin and the pending one', async () => {
    const result = await findExpenseDraftDuplicates(probeDraftId)
    if (!result.success) throw new Error(result.error)
    const ours = (matches: { source: string; id: number }[]) =>
      matches
        .filter((m) =>
          m.source === 'transaction'
            ? Object.values(tx).includes(m.id)
            : [otherDraftId, rejectedDraftId, probeDraftId].includes(m.id),
        )
        .map((m) => `${m.source}-${m.id}`)

    const [byAmount, byNumber, byLegacyNote] = result.data
    // The other zgłoszenie's paragons share only the amount — a different shop and day.
    expect(ours(byAmount.matches)).toEqual([`transaction-${tx.byAmount}`])
    expect(ours(byNumber.matches)).toEqual([`transaction-${tx.byNumber}`])
    expect(ours(byLegacyNote.matches)).toEqual([`transaction-${tx.legacyNote}`])
  })
})
