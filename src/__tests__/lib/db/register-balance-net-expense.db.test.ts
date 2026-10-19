import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createRegisterOwner } from '@/__tests__/helpers/register'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

// INVESTMENT_EXPENSE_NET is the one type whose billed figure (`net_amount`) differs from the cash that left the register (`amount`).

const GROSS = 1230
const NET = 1000

describe.skipIf(!ENV_READY)('sumRegisterBalance — INVESTMENT_EXPENSE_NET (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  let investmentId: number
  let ownerId: number

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)
    ;({ ownerId, registerId } = await createRegisterOwner(
      payload,
      {
        name: 'Net Expense Owner',
        email: 'net-expense-owner@test.local',
        registerName: 'net-expense-register',
      },
      { context: { skipRevalidation: true } },
    ))

    investmentId = await createTestInvestment(payload, 'net-expense-investment')

    await db.execute(sql`
      INSERT INTO transactions
        (description, amount, net_amount, date, type, payment_method, source_register_id, investment_id, cancelled)
      VALUES ('net expense', ${GROSS}, ${NET}, now(),
        'INVESTMENT_EXPENSE_NET'::enum_transactions_type, 'TRANSFER',
        ${registerId}, ${investmentId}, false)
    `)
  })

  afterAll(async () => {
    if (registerId)
      await db.execute(sql`DELETE FROM transactions WHERE source_register_id = ${registerId}`)
    if (registerId)
      await payload.delete({
        collection: 'cash-registers',
        id: registerId,
        context: { skipRevalidation: true },
      })
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    if (ownerId)
      await payload.delete({
        collection: 'users',
        id: ownerId,
        context: { skipRevalidation: true },
      })
  })

  it('subtracts the brutto amount, not the netto one', async () => {
    expect(await sumRegisterBalance(payload, registerId)).toBe(-GROSS)
  })
})
