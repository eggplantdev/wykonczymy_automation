import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'
import { createTestRegister } from '@/__tests__/helpers/transfer-fixtures'

const MARKER = 'EX-680 deposit invariant'

describe.skipIf(!ENV_READY)('company deposits never persist an investment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let ownerId: number
  let registerId: number
  const persisted: Record<string, number> = {}

  async function createDeposit(
    type: 'INVESTOR_DEPOSIT' | 'COMPANY_FUNDING' | 'OTHER_DEPOSIT',
    amount: number,
  ): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} ${type}`,
        amount,
        date: '2026-08-12T09:00:00.000Z',
        type,
        paymentMethod: 'TRANSFER',
        sourceRegister: registerId,
        investment: investmentId,
      },
      overrideAccess: true,
      context: { skipRevalidation: true, skipSheetSync: true },
    })
    return Number(created.id)
  }

  async function persistedInvestmentId(transactionId: number): Promise<number | null> {
    const result = await db.execute(sql`
      SELECT investment_id FROM transactions WHERE id = ${transactionId}
    `)
    const value = result.rows[0]?.investment_id
    return value === null || value === undefined ? null : Number(value)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    // On entry, not only in teardown: the two rows this spec cares about end up with a NULL
    // investment, so a crashed run leaves rows no investment-scoped delete could ever reach.
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)

    // This spec CREDITS the register, and a leftover row on the main kasa silently changes what
    // `pnpm test:parity`'s golden master guards.
    ownerId = await createTestUser(payload, {
      name: 'Deposit Invariant Owner',
      email: 'deposit-invariant-owner@test.local',
    })

    registerId = await createTestRegister(payload, ownerId, 'deposit-invariant-register')

    investmentId = await createTestInvestment(payload, 'deposit-invariant-investment')

    persisted.companyFunding = await createDeposit('COMPANY_FUNDING', 7000)
    persisted.otherDeposit = await createDeposit('OTHER_DEPOSIT', 1000)
    persisted.investorDeposit = await createDeposit('INVESTOR_DEPOSIT', 5000)
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
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

  it('strips the investment from a COMPANY_FUNDING write', async () => {
    expect(await persistedInvestmentId(persisted.companyFunding!)).toBeNull()
  })

  it('strips the investment from an OTHER_DEPOSIT write', async () => {
    expect(await persistedInvestmentId(persisted.otherDeposit!)).toBeNull()
  })

  it('keeps the investment on an INVESTOR_DEPOSIT write', async () => {
    expect(await persistedInvestmentId(persisted.investorDeposit!)).toBe(investmentId)
  })
})
