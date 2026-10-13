import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// The persisted-row half of `investment-write-guard.test.ts`, which pins the same EX-557 invariant on
// the hook in isolation: COMPANY_FUNDING and OTHER_DEPOSIT are company-level cash and can never carry
// an investment. The client wpłaty figure stands on it — it is what makes the deposit list and the
// income aggregate agree for a single investment (EX-680).
// Nobody asserted the row that actually lands, and a plain scan of existing rows would be vacuously
// green: a prod dump contains no such row to begin with.

vi.mock('server-only', () => ({}))
// The sheet-sync hook defers to after(), which needs a request scope and live Google credentials.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
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
        // The whole point: every one of these asks for the investment. Only INVESTOR_DEPOSIT keeps it.
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
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // On entry, not only in teardown: the two rows this spec cares about end up with a NULL
    // investment, so a crashed run leaves rows no investment-scoped delete could ever reach.
    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)

    // Its own register rather than the lowest-id one from the prod restore: this spec CREDITS the
    // register, and a leftover row on the main kasa silently changes what `pnpm test:parity`'s
    // golden master guards.
    const owner = await payload.create({
      collection: 'users',
      data: {
        name: 'Deposit Invariant Owner',
        role: 'EMPLOYEE',
        email: 'deposit-invariant-owner@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    ownerId = Number(owner.id)

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'deposit-invariant-register', owner: ownerId, type: 'AUXILIARY' },
      context: { skipRevalidation: true },
    })
    registerId = Number(register.id)

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

  // Positive control: without it the two assertions above would also pass on a build that nulls
  // investment_id for every deposit type.
  it('keeps the investment on an INVESTOR_DEPOSIT write', async () => {
    expect(await persistedInvestmentId(persisted.investorDeposit!)).toBe(investmentId)
  })
})
