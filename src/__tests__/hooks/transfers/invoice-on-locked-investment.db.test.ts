import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'

// The hook-level spec (`validate-lock.test.ts`) feeds `validateTransfer` a hand-built `{ invoice: … }`
// patch and sees the exception let it through. Production does not: `payload.update` hands the hook a
// different `data`, so the one write EX-748 deliberately leaves open — attaching or detaching a scan
// of the faktura — was refused on a zakończona inwestycja. Only a real update through Payload can see
// that, which is why this spec exists next to the isolated one rather than in place of it.

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
  let ownerId: number
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

    // A crashed run leaves its own fixtures behind, and both the user email and the register name
    // are unique — without this the NEXT run fails on the leftovers instead of on the invariant.
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await db.execute(sql`DELETE FROM cash_registers WHERE name = 'invoice-lock-register'`)
    await db.execute(sql`DELETE FROM users WHERE email = 'invoice-lock-owner@test.local'`)

    const owner = await payload.create({
      collection: 'users',
      data: {
        name: 'Invoice Lock Owner',
        role: 'EMPLOYEE',
        email: 'invoice-lock-owner@test.local',
        password: 'test-password-123',
      },
      ...ctx,
    })
    ownerId = Number(owner.id)

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'invoice-lock-register', owner: ownerId, type: 'AUXILIARY' },
      ...ctx,
    })
    registerId = Number(register.id)

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

    // An existing scan rather than a fresh upload: creating one would push bytes to the Blob store.
    const media = await payload.find({
      collection: 'media',
      limit: 1,
      sort: 'id',
      depth: 0,
      overrideAccess: true,
    })
    const scan = media.docs[0]
    if (!scan) throw new Error('no media row in the DB to attach as a faktura')
    mediaId = Number(scan.id)

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
    if (registerId) await payload.delete({ collection: 'cash-registers', id: registerId, ...ctx })
    if (investmentId) {
      // Raw SQL, because reopening a zakończona inwestycja through Payload needs an OWNER on the
      // request and this spec books no user session.
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${investmentId}`)
      await deleteTestInvestment(payload, investmentId)
    }
    if (ownerId) await payload.delete({ collection: 'users', id: ownerId, ...ctx })
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

  // The removal is the other half of the same exception, and it is the one a key-based test waves
  // through by accident: an empty array patches nothing away from the stored row's other fields.
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

  // Positive control: the lock still bites everything that is not the faktura.
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
