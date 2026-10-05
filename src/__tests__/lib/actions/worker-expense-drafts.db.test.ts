import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { insertWorkerExpenseDraft } from '@/lib/db/worker-expense-drafts'
import { DRAFT_ALREADY_DECIDED } from '@/lib/constants/worker-expense-drafts'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
// after() schedules the sheet sync (live Google credentials) and throws outside a request scope.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const { createBulkTransferAction } = await import('@/lib/actions/transfers')
const { rejectExpenseDraftAction } = await import('@/lib/actions/worker-expense-drafts')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const FILENAME_PREFIX = 'ex-971-decide-'

describe.skipIf(!ENV_READY)('expense draft accept / reject (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number
  let expenseCategoryId: number

  const ctx = { context: { skipRevalidation: true } }

  async function createDraft(name: string): Promise<number> {
    const { rows } = await db.execute(sql`
      INSERT INTO media (filename, mime_type, filesize, created_by_id)
      VALUES (${`${FILENAME_PREFIX}${name}.jpg`}, 'image/jpeg', 1024, ${workerId})
      RETURNING id
    `)
    const draftId = await insertWorkerExpenseDraft(db, {
      workerId,
      investmentId,
      cashRegisterId: registerId,
      note: null,
      mediaIds: [Number(rows[0].id)],
    })
    if (draftId === null) throw new Error('draft fixture refused')
    return draftId
  }

  const readDraft = async (draftId: number) =>
    (
      await db.execute(
        sql`SELECT status, transfer_id FROM worker_expense_drafts WHERE id = ${draftId}`,
      )
    ).rows[0]

  const expensesDescribed = async (description: string) =>
    (
      await db.execute(sql`SELECT id FROM transactions WHERE description = ${description}`)
    ).rows.map((row) => Number(row.id))

  const accept = (draftId: number, description: string) =>
    createBulkTransferAction(
      {
        date: new Date().toISOString().slice(0, 10),
        type: 'INVESTMENT_EXPENSE',
        paymentMethod: 'CASH',
        sourceRegister: registerId,
        investment: investmentId,
        lineItems: [{ description, amount: 42.5, expenseCategory: expenseCategoryId }],
      },
      undefined,
      { expenseDraftId: draftId },
    )

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    investmentId = await createTestInvestment(payload, 'worker-expense-decide-db-test')
    ;({ ownerId: workerId, registerId } = await createRegisterOwner(
      payload,
      { name: 'Decide W', email: 'worker-expense-decide@test.local', registerName: 'Kasa W' },
      ctx,
    ))
    const managers = await payload.find({
      collection: 'users',
      where: { role: { equals: 'OWNER' } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const categories = await payload.find({
      collection: 'expense-categories',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    if (!managers.docs[0] || !categories.docs[0]) throw new Error('missing OWNER / category')
    authState.userId = Number(managers.docs[0].id)
    expenseCategoryId = Number(categories.docs[0].id)
  })

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM transactions WHERE source_register_id = ${registerId}
    `)
    await db.execute(sql`DELETE FROM media WHERE filename LIKE ${`${FILENAME_PREFIX}%`}`)
    if (investmentId) await deleteTestInvestment(payload, investmentId).catch(() => {})
    await purgeFixtureUsers(db)
  })

  it('accepting books the expense and marks the draft accepted with that expense', async () => {
    const draftId = await createDraft('accept')
    const description = `EX-971 accept ${draftId}`

    expect(await accept(draftId, description)).toMatchObject({ success: true })

    const expenses = await expensesDescribed(description)
    expect(expenses).toHaveLength(1)
    expect(await readDraft(draftId)).toMatchObject({
      status: 'accepted',
      transfer_id: expenses[0],
    })
  })

  // Two managers on one draft: the loser's expense must roll back with the refusal, or the
  // receipt is booked twice.
  it('a second accept of the same draft is refused and books nothing', async () => {
    const draftId = await createDraft('twice')
    const description = `EX-971 twice ${draftId}`
    await accept(draftId, description)

    expect(await accept(draftId, description)).toEqual({
      success: false,
      error: DRAFT_ALREADY_DECIDED,
    })
    expect(await expensesDescribed(description)).toHaveLength(1)
  })

  it('rejecting marks the draft rejected; rejecting an accepted one changes nothing', async () => {
    const pending = await createDraft('reject')
    expect(await rejectExpenseDraftAction(pending)).toMatchObject({ success: true })
    expect(await readDraft(pending)).toMatchObject({ status: 'rejected', transfer_id: null })

    const accepted = await createDraft('reject-accepted')
    await accept(accepted, `EX-971 reject-accepted ${accepted}`)
    const before = await readDraft(accepted)

    expect(await rejectExpenseDraftAction(accepted)).toEqual({
      success: false,
      error: DRAFT_ALREADY_DECIDED,
    })
    expect(await readDraft(accepted)).toEqual(before)
  })
})
