import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  getDepositTransactions,
  getDepositTransactionsForInvestment,
} from '@/lib/db/get-deposit-transactions'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getDepositTransactions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  async function insertDeposit(opts: {
    type: 'INVESTOR_DEPOSIT' | 'COMPANY_FUNDING'
    amount: number
    date: string
    cancelled?: boolean
  }): Promise<void> {
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, cancelled)
      VALUES ('test', ${opts.amount}, ${opts.date}::timestamptz,
        ${opts.type}::enum_transactions_type, 'TRANSFER', ${investmentId}, ${opts.cancelled ?? false})
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'deposit-transactions-where-test')

    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 5000, date: '2026-03-05T09:00:00Z' })
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 3000, date: '2026-05-20T09:00:00Z' })
    await insertDeposit({
      type: 'INVESTOR_DEPOSIT',
      amount: 999,
      date: '2026-05-21T09:00:00Z',
      cancelled: true,
    })
    await insertDeposit({ type: 'COMPANY_FUNDING', amount: 7000, date: '2026-05-22T09:00:00Z' })
  })

  afterAll(async () => {
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      await deleteTestInvestment(payload, investmentId)
    }
  })

  it('matches the investment-scoped fetcher for an investment-only Where', async () => {
    const viaWhere = await getDepositTransactions(payload, {
      investment: { equals: investmentId },
    })
    const viaInvestment = await getDepositTransactionsForInvestment(payload, investmentId)

    expect(viaWhere).toEqual(viaInvestment)
    expect(viaWhere.reduce((sum, row) => sum + row.amount, 0)).toBe(8000)
  })

  it('narrows to a date range', async () => {
    const rows = await getDepositTransactions(payload, {
      investment: { equals: investmentId },
      date: { greater_than_equal: '2026-05-01' },
    })

    expect(rows.map((row) => row.amount)).toEqual([3000])
  })

  it('returns nothing when the caller filters to a type that is not INVESTOR_DEPOSIT', async () => {
    const rows = await getDepositTransactions(payload, {
      investment: { equals: investmentId },
      type: { in: ['PAYOUT'] },
    })

    expect(rows).toEqual([])
  })

  it('cannot surface a cancelled deposit, even when the caller asks for one', async () => {
    const rows = await getDepositTransactions(payload, {
      investment: { equals: investmentId },
      cancelled: { equals: true },
    })

    expect(rows).toEqual([])
  })

  it('short-circuits the NO_RESULTS sentinel before touching the DB', async () => {
    // A payload stand-in that would throw the moment `getDb` looked at it
    const rows = await getDepositTransactions({} as Payload, { id: { equals: -1 } })

    expect(rows).toEqual([])
  })
})
