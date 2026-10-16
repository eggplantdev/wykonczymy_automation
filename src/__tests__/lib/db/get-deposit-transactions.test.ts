import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { getDepositTransactionsForInvestment } from '@/lib/db/get-deposit-transactions'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('getDepositTransactionsForInvestment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  async function insertDeposit(opts: {
    type: 'INVESTOR_DEPOSIT' | 'COMPANY_FUNDING' | 'OTHER_DEPOSIT'
    amount: number
    vatPlane?: 'NET' | 'GROSS'
    cancelled?: boolean
  }): Promise<void> {
    const vatPlane = opts.vatPlane ?? null
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, vat_plane, cancelled)
      VALUES ('test', ${opts.amount}, '2026-07-18T09:00:00Z'::timestamptz,
        ${opts.type}::enum_transactions_type, 'TRANSFER', ${investmentId},
        ${vatPlane}::enum_transactions_vat_plane, ${opts.cancelled ?? false})
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'get-deposit-transactions-test')

    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 5000, vatPlane: 'GROSS' })
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 3000 })
    await insertDeposit({ type: 'INVESTOR_DEPOSIT', amount: 999, cancelled: true })
    await insertDeposit({ type: 'COMPANY_FUNDING', amount: 7000 })
    await insertDeposit({ type: 'OTHER_DEPOSIT', amount: 1000 })
  })

  afterAll(async () => {
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      await deleteTestInvestment(payload, investmentId)
    }
  })

  it('returns only non-cancelled INVESTOR_DEPOSIT rows — legacy planes never enter client wpłaty', async () => {
    const rows = await getDepositTransactionsForInvestment(payload, investmentId)

    expect(rows).toHaveLength(2)

    const depositsNet = rows.reduce((sum, row) => sum + row.amount, 0)
    expect(depositsNet).toBe(8000)

    expect([...rows].map((row) => row.vatPlane).sort()).toEqual(['GROSS', null])
  })
})
