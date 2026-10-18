import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { sql } from '@payloadcms/db-postgres'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { firstUserId } from '@/__tests__/helpers/user'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const { createBulkTransferAction } = await import('@/lib/actions/transfers')

describe.skipIf(!ENV_READY)('PAYOUT to a worker with no assigned etapy (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number
  const createdTransactions: number[] = []

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)

    const [createdInvestmentId, userId, registers] = await Promise.all([
      createTestInvestment(payload, 'payout-without-stages spec'),
      firstUserId(payload),
      payload.find({
        collection: 'cash-registers',
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
    ])
    investmentId = createdInvestmentId
    const register = registers.docs[0]
    if (!register) throw new Error('missing DB fixtures for a PAYOUT')
    workerId = userId
    registerId = Number(register.id)
    authState.userId = workerId
  })

  afterAll(async () => {
    for (const id of createdTransactions) {
      await payload.delete({ collection: 'transactions', id, overrideAccess: true })
    }
    if (investmentId) await deleteTestInvestment(payload, investmentId)
  })

  it('persists the transaction even though the worker holds no etapy on the investment', async () => {
    const assigned = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM kosztorys_stage_workers sw
      JOIN kosztorys_stages s ON s.id = sw.stage_id
      WHERE s.investment_id = ${investmentId} AND sw.worker_id = ${workerId}
    `)
    expect(assigned.rows[0].count).toBe(0)

    const description = `EX-613 wypłata bez etapów ${investmentId}-${workerId}`
    const result = await createBulkTransferAction({
      date: new Date().toISOString().slice(0, 10),
      type: 'PAYOUT',
      paymentMethod: 'CASH',
      sourceRegister: registerId,
      investment: investmentId,
      worker: workerId,
      lineItems: [{ description, amount: 123.45 }],
    })
    expect(result).toMatchObject({ success: true })

    const persisted = await db.execute(sql`
      SELECT id, amount::float8 AS amount, worker_id, investment_id
      FROM transactions WHERE description = ${description}
    `)
    expect(persisted.rows).toHaveLength(1)
    const row = persisted.rows[0]
    createdTransactions.push(Number(row.id))
    expect(row).toMatchObject({
      amount: 123.45,
      worker_id: workerId,
      investment_id: investmentId,
    })
  })
})
