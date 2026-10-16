import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createRegisterOwner, findExistingMediaId } from '@/__tests__/helpers/transfer-fixtures'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'EX-748 invoice on locked'

describe.skipIf(!ENV_READY)('faktura on a locked investment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let registerId: number
  let transactionId: number
  let expenseCategoryId: number
  let mediaId: number
  const ctx = { context: { skipRevalidation: true, skipSheetSync: true } }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)
    ;({ registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Invoice Lock Owner',
        email: 'invoice-lock-owner@test.local',
        registerName: 'invoice-lock-register',
      },
      ctx,
    ))

    investmentId = await createTestInvestment(payload, 'invoice-lock-investment')

    const categories = await payload.find({
      collection: 'expense-categories',
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const category = categories.docs[0]
    if (!category) throw new Error('no expense category in the DB to attach the fixture to')
    expenseCategoryId = Number(category.id)

    mediaId = await findExistingMediaId(payload)

    const transaction = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} expense`,
        amount: 100,
        date: '2026-09-03T09:00:00.000Z',
        type: 'INVESTMENT_EXPENSE',
        expenseCategory: expenseCategoryId,
        paymentMethod: 'TRANSFER',
        sourceRegister: registerId,
        investment: investmentId,
      },
      overrideAccess: true,
      ...ctx,
    })
    transactionId = Number(transaction.id)

    await payload.update({
      collection: 'investments',
      id: investmentId,
      data: { status: LOCKED_INVESTMENT_STATUS },
      overrideAccess: true,
      ...ctx,
    })
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)
    if (investmentId) {
      // Raw SQL, because reopening a zakończona inwestycja through Payload needs an OWNER on the
      // request and this spec books no user session.
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${investmentId}`)
      await deleteTestInvestment(payload, investmentId)
    }
  })

  async function attachedMediaIds(): Promise<number[]> {
    const result = await db.execute(sql`
      SELECT media_id FROM transactions_rels WHERE parent_id = ${transactionId} AND media_id IS NOT NULL
    `)
    return result.rows.map((row) => Number(row.media_id))
  }

  it('attaches a faktura to a transaction of a locked investment', async () => {
    await payload.update({
      collection: 'transactions',
      id: transactionId,
      data: { invoice: [mediaId] },
      overrideAccess: true,
      ...ctx,
    })
    expect(await attachedMediaIds()).toEqual([mediaId])
  })

  it('detaches it again', async () => {
    await payload.update({
      collection: 'transactions',
      id: transactionId,
      data: { invoice: [] },
      overrideAccess: true,
      ...ctx,
    })
    expect(await attachedMediaIds()).toEqual([])
  })

  it('still refuses a non-invoice update', async () => {
    await expect(
      payload.update({
        collection: 'transactions',
        id: transactionId,
        data: { amount: 999 },
        overrideAccess: true,
        ...ctx,
      }),
    ).rejects.toThrow(/zakończona/i)
  })
})
