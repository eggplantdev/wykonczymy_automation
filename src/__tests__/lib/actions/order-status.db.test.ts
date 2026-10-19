import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { INVESTMENT_LOCKED_MESSAGE } from '@/lib/constants/investment-lock'

const { createBulkTransferAction } = await import('@/lib/actions/transfers')
const { setOrderStatusAction } = await import('@/lib/actions/order-status')

const MARKER = 'order-status spec'

describe.skipIf(!ENV_READY)('setOrderStatusAction (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let investmentId: number
  let lockedInvestmentId: number
  let registerId: number
  let expenseCategoryId: number

  const rowOf = async (id: number) => {
    const result = await db.execute(sql`
      SELECT order_status, amount, description, updated_by_id FROM transactions WHERE id = ${id}
    `)
    return result.rows[0]
  }

  const book = async (description: string, investment: number, order = true) => {
    const result = await createBulkTransferAction(
      {
        date: new Date().toISOString().slice(0, 10),
        type: 'INVESTMENT_EXPENSE',
        paymentMethod: 'CASH',
        sourceRegister: registerId,
        investment,
        lineItems: [{ description, amount: 800, expenseCategory: expenseCategoryId }],
      },
      undefined,
      undefined,
      { order },
    )
    expect(result.success).toBe(true)
    const found = await db.execute(sql`
      SELECT id FROM transactions WHERE description = ${description} ORDER BY id DESC LIMIT 1
    `)
    return Number(found.rows[0].id)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    const [owner, registers, categories] = await Promise.all([
      firstUserId(payload, { role: 'OWNER' }),
      payload.find({ collection: 'cash-registers', limit: 1, sort: 'id', depth: 0, overrideAccess: true }),
      payload.find({ collection: 'expense-categories', limit: 1, depth: 0, overrideAccess: true }),
    ])
    if (!registers.docs[0] || !categories.docs[0]) throw new Error('missing DB fixtures')
    ownerId = owner
    authState.userId = ownerId
    registerId = Number(registers.docs[0].id)
    expenseCategoryId = Number(categories.docs[0].id)
    investmentId = await createTestInvestment(payload, MARKER)
    lockedInvestmentId = await createTestInvestment(payload, `${MARKER} locked`)
  })

  afterEach(() => {
    authState.role = 'OWNER'
    authState.userId = ownerId
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    if (lockedInvestmentId) {
      await db.execute(sql`UPDATE investments SET status = 'active' WHERE id = ${lockedInvestmentId}`)
      await deleteTestInvestment(payload, lockedInvestmentId)
    }
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('toggles both ways and changes nothing but the status', async () => {
    const id = await book(`${MARKER} toggle`, investmentId)

    expect(await setOrderStatusAction(id, 'delivered')).toEqual({ success: true })
    expect(await rowOf(id)).toMatchObject({
      order_status: 'delivered',
      description: `${MARKER} toggle`,
      updated_by_id: ownerId,
    })
    expect(Number((await rowOf(id)).amount)).toBe(800)

    expect(await setOrderStatusAction(id, 'awaiting')).toEqual({ success: true })
    expect((await rowOf(id)).order_status).toBe('awaiting')
  })

  it('refuses a cancelled row', async () => {
    const id = await book(`${MARKER} cancelled`, investmentId)
    await db.execute(sql`UPDATE transactions SET cancelled = true WHERE id = ${id}`)

    expect((await setOrderStatusAction(id, 'delivered')).success).toBe(false)
    expect((await rowOf(id)).order_status).toBe('awaiting')
  })

  it('refuses a row that is not an order', async () => {
    const id = await book(`${MARKER} plain`, investmentId, false)

    expect((await setOrderStatusAction(id, 'delivered')).success).toBe(false)
    expect((await rowOf(id)).order_status).toBeNull()
  })

  it('is refused on a completed investment', async () => {
    const id = await book(`${MARKER} locked`, lockedInvestmentId)
    await db.execute(sql`UPDATE investments SET status = 'completed' WHERE id = ${lockedInvestmentId}`)

    expect(await setOrderStatusAction(id, 'delivered')).toMatchObject({
      success: false,
      error: INVESTMENT_LOCKED_MESSAGE,
    })
    expect((await rowOf(id)).order_status).toBe('awaiting')
  })

  it('refuses an EMPLOYEE', async () => {
    const id = await book(`${MARKER} employee`, investmentId)
    authState.role = 'EMPLOYEE'

    expect((await setOrderStatusAction(id, 'delivered')).success).toBe(false)
    expect((await rowOf(id)).order_status).toBe('awaiting')
  })
})
