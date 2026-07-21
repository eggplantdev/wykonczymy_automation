import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { sumPayoutsByWorkerForInvestment } from '@/lib/db/sum-transfers'

// sumPayoutsByWorkerForInvestment is raw SQL (GROUP BY worker_id, null bucket kept, investment-scoped,
// cancelled + non-PAYOUT excluded), so its grouping is only real against the DB. Insert rows directly
// to bypass the balance-recalc hooks and required-field validation — we assert the aggregate, not a
// return value from a create.
vi.mock('next/cache', () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('sumPayoutsByWorkerForInvestment (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let otherInvestmentId: number
  let workerA: number
  let workerB: number

  // Raw insert: only the NOT NULL columns (description/amount/date/type/payment_method) plus the ones
  // the query reads (investment_id, worker_id, cancelled). cash_register_id is nullable post-overhaul.
  async function insertTx(opts: {
    type: string
    amount: number
    investmentId: number | null
    workerId: number | null
    cancelled?: boolean
  }): Promise<void> {
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, investment_id, worker_id, cancelled)
      VALUES ('test', ${opts.amount}, now(), ${opts.type}::enum_transactions_type, 'TRANSFER',
        ${opts.investmentId}, ${opts.workerId}, ${opts.cancelled ?? false})
    `)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    const inv = await payload.create({
      collection: 'investments',
      data: { name: 'payouts-by-worker-test', status: 'active' },
      context: { skipRevalidation: true },
    })
    investmentId = Number(inv.id)
    const other = await payload.create({
      collection: 'investments',
      data: { name: 'payouts-by-worker-other', status: 'active' },
      context: { skipRevalidation: true },
    })
    otherInvestmentId = Number(other.id)

    const a = await payload.create({
      collection: 'users',
      data: {
        name: 'Worker A',
        role: 'EMPLOYEE',
        email: 'payouts-worker-a@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerA = Number(a.id)
    const b = await payload.create({
      collection: 'users',
      data: {
        name: 'Worker B',
        role: 'EMPLOYEE',
        email: 'payouts-worker-b@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerB = Number(b.id)

    // Two PAYOUTs for workerA (must sum), one for workerB, one with no worker (null bucket kept).
    await insertTx({ type: 'PAYOUT', amount: 100, investmentId, workerId: workerA })
    await insertTx({ type: 'PAYOUT', amount: 50, investmentId, workerId: workerA })
    await insertTx({ type: 'PAYOUT', amount: 200, investmentId, workerId: workerB })
    await insertTx({ type: 'PAYOUT', amount: 30, investmentId, workerId: null })
    // Excluded: cancelled, non-PAYOUT, and a PAYOUT on a different investment.
    await insertTx({
      type: 'PAYOUT',
      amount: 999,
      investmentId,
      workerId: workerA,
      cancelled: true,
    })
    await insertTx({ type: 'INVESTMENT_EXPENSE', amount: 999, investmentId, workerId: workerA })
    await insertTx({
      type: 'PAYOUT',
      amount: 500,
      investmentId: otherInvestmentId,
      workerId: workerA,
    })
  })

  afterAll(async () => {
    // Delete the fixture transactions by investment (all inserts carry one of the two ids) before the
    // investments themselves, so no FK dangles.
    for (const id of [investmentId, otherInvestmentId]) {
      if (id) await db.execute(sql`DELETE FROM transactions WHERE investment_id = ${id}`)
    }
    for (const id of [workerA, workerB]) {
      if (id) await payload.delete({ collection: 'users', id, context: { skipRevalidation: true } })
    }
    for (const id of [investmentId, otherInvestmentId]) {
      if (id)
        await payload.delete({
          collection: 'investments',
          id,
          context: { skipRevalidation: true },
        })
    }
  })

  it('groups PAYOUTs per worker, keeps the null bucket, and excludes cancelled / non-PAYOUT / other investments', async () => {
    const rows = await sumPayoutsByWorkerForInvestment(payload, investmentId)
    const byWorker = new Map(rows.map((row) => [row.workerId, row.total]))

    expect(byWorker.get(workerA)).toBe(150)
    expect(byWorker.get(workerB)).toBe(200)
    expect(byWorker.get(null)).toBe(30)
    // Exactly three groups — no cancelled row, no INVESTMENT_EXPENSE, no other-investment PAYOUT.
    expect(rows).toHaveLength(3)
  })
})
