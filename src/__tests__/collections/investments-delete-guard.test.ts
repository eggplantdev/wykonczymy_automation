import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'

// The FK is ON DELETE SET NULL, so the failure mode this guards has no error to notice: without the
// hook the delete SUCCEEDS and Postgres quietly orphans every referencing transaction.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('investments beforeDelete guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number

  async function investmentExists(): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${investmentId}`)
    return result.rows.length > 0
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'delete-guard-investment')

    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, cancelled)
      VALUES ('delete-guard labor cost', 1000, now(),
        'LABOR_COST'::enum_transactions_type, 'TRANSFER', ${investmentId}, false)
    `)
  })

  afterAll(async () => {
    // The last test deletes the investment itself, so teardown must tolerate it being gone already —
    // a blind delete would throw NotFound and turn a green run red.
    if (investmentId) {
      await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)
      if (await investmentExists()) await deleteTestInvestment(payload, investmentId)
    }
  })

  it('refuses to delete an investment that still has transactions', async () => {
    await expect(deleteTestInvestment(payload, investmentId)).rejects.toThrow(
      /Nie można usunąć inwestycji/,
    )
    expect(await investmentExists()).toBe(true)
  })

  // Positive control: without it the assertion above would also pass on a hook that blocks every delete.
  it('allows the delete once the transactions are gone', async () => {
    await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${investmentId}`)

    await deleteTestInvestment(payload, investmentId)
    expect(await investmentExists()).toBe(false)
  })
})

describe.skipIf(!ENV_READY)('investments beforeDelete guard — cancelled rows (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let transactionId: number

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    investmentId = await createTestInvestment(payload, 'delete-guard-cancelled')

    const inserted = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, cancelled)
      VALUES ('delete-guard cancelled labor cost', 1000, now(),
        'LABOR_COST'::enum_transactions_type, 'TRANSFER', ${investmentId}, true)
      RETURNING id
    `)
    transactionId = (inserted.rows[0] as { id: number }).id
  })

  // The `it` body is what deletes the investment, so a regressed guard would throw before it and
  // strand the row in the shared 5435 DB — where the golden master then reads it as dataset drift.
  afterAll(async () => {
    if (transactionId) await db.execute(sql`DELETE FROM transactions WHERE id = ${transactionId}`)
    if (investmentId) {
      const investment = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${investmentId}`)
      if (investment.rows.length > 0) await deleteTestInvestment(payload, investmentId)
    }
  })

  it('deletes an investment whose only transactions are cancelled, orphaning them', async () => {
    await deleteTestInvestment(payload, investmentId)

    const investment = await db.execute(sql`SELECT 1 FROM investments WHERE id = ${investmentId}`)
    expect(investment.rows.length).toBe(0)

    const transaction = await db.execute(
      sql`SELECT investment_id FROM transactions WHERE id = ${transactionId}`,
    )
    expect(transaction.rows.length).toBe(1)
    expect((transaction.rows[0] as { investment_id: number | null }).investment_id).toBeNull()
  })
})
