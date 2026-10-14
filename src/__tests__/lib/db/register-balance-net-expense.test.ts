import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { sumRegisterBalance } from '@/lib/db/sum-transfers'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// GUARD B2 — the kasa stays brutto. INVESTMENT_EXPENSE_NET is the one type whose billed
// figure (`net_amount`) differs from the cash that left the register (`amount`), so the
// question "which column does sumRegisterBalance subtract" stopped being rhetorical.
//
// This has to be a DB test, not a unit: the risk lives inside raw SQL. Asserting that the
// type is absent from DEPOSIT_TYPES proves nothing about which column the CASE arm reads,
// and only a query actually executed can prove it never switched to net_amount.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

const GROSS = 1230
const NET = 1000

describe.skipIf(!ENV_READY)('sumRegisterBalance — INVESTMENT_EXPENSE_NET (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  let investmentId: number
  let ownerId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const owner = await payload.create({
      collection: 'users',
      data: {
        name: 'Net Expense Owner',
        role: 'EMPLOYEE',
        email: 'net-expense-owner@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    ownerId = Number(owner.id)

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'net-expense-register', owner: ownerId, type: 'AUXILIARY' },
      context: { skipRevalidation: true },
    })
    registerId = Number(register.id)

    investmentId = await createTestInvestment(payload, 'net-expense-investment')

    // Raw insert to bypass the balance-recalc hooks — the aggregate under test is the
    // query, not the cached `balance` column those hooks write.
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
