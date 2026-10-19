import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { createBulkTransferAction } = await import('@/lib/actions/transfers')

const MARKER = 'order-flag spec'

describe.skipIf(!ENV_READY)('createBulkTransferAction order flag (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let registerId: number
  let expenseCategoryId: number

  const statusesOf = async (description: string) => {
    const result = await db.execute(sql`
      SELECT order_status FROM transactions WHERE description = ${description} ORDER BY id
    `)
    return result.rows.map((row) => row.order_status)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    const [ownerId, registers, categories] = await Promise.all([
      firstUserId(payload, { role: 'OWNER' }),
      payload.find({ collection: 'cash-registers', limit: 1, sort: 'id', depth: 0, overrideAccess: true }),
      payload.find({ collection: 'expense-categories', limit: 1, depth: 0, overrideAccess: true }),
    ])
    if (!registers.docs[0] || !categories.docs[0]) throw new Error('missing DB fixtures')
    authState.userId = ownerId
    registerId = Number(registers.docs[0].id)
    expenseCategoryId = Number(categories.docs[0].id)
    investmentId = await createTestInvestment(payload, MARKER)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  const book = (
    description: string,
    type: 'INVESTMENT_EXPENSE' | 'INVESTMENT_EXPENSE_NET' | 'CORRECTION',
    amounts: number[],
    flags?: { order?: boolean },
  ) =>
    createBulkTransferAction(
      {
        date: new Date().toISOString().slice(0, 10),
        type,
        paymentMethod: 'CASH',
        sourceRegister: registerId,
        investment: investmentId,
        lineItems: amounts.map((amount) => ({
          description,
          amount,
          netAmount: type === 'INVESTMENT_EXPENSE_NET' ? Math.abs(amount) : undefined,
          expenseCategory: expenseCategoryId,
        })),
      },
      undefined,
      undefined,
      flags,
    )

  it('stamps every row of a flagged investment expense as awaiting', async () => {
    const description = `${MARKER} flagged`
    expect(await book(description, 'INVESTMENT_EXPENSE', [800, 1500], { order: true })).toEqual({
      success: true,
    })
    expect(await statusesOf(description)).toEqual(['awaiting', 'awaiting'])
  })

  it('leaves the status empty without the flag', async () => {
    const description = `${MARKER} plain`
    expect(await book(description, 'INVESTMENT_EXPENSE', [800])).toEqual({ success: true })
    expect(await statusesOf(description)).toEqual([null])
  })

  it('ignores the flag on a type that is not an investment expense', async () => {
    const description = `${MARKER} correction`
    expect(await book(description, 'CORRECTION', [-50], { order: true })).toEqual({ success: true })
    expect(await statusesOf(description)).toEqual([null])
  })

  it('stamps a flagged net investment expense', async () => {
    const description = `${MARKER} net`
    expect(await book(description, 'INVESTMENT_EXPENSE_NET', [1230], { order: true })).toEqual({
      success: true,
    })
    expect(await statusesOf(description)).toEqual(['awaiting'])
  })
})
