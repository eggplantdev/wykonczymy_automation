import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { getDb } from '@/lib/db/get-db'
import { LOCKED_INVESTMENT_STATUS } from '@/lib/constants/investment-lock'
import { sql } from '@payloadcms/db-vercel-postgres'

// EX-613 puts two loud warnings on the wypłata form when the chosen person has no etapy assigned.
// They are warnings, not gates — and „not a gate" is only true if the write actually lands. So this
// runs the REAL action against the REAL DB and asserts the PERSISTED transaction, not the action's
// return value: a `{ success: true }` from a rolled-back transaction looks identical.
vi.mock('server-only', () => ({}))
// after() schedules the post-response sheet sync (live Google credentials); it also throws outside a
// request scope. Not under test.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})
const authState = vi.hoisted(() => ({ userId: 0 }))
vi.mock('@/lib/auth/require-auth', () => ({
  requireAuth: vi.fn(async () => ({
    success: true,
    user: { id: authState.userId, email: 'o@t.com', name: 'Owner', role: 'OWNER' },
  })),
}))
vi.mock('@/lib/cache/revalidate', () => ({ revalidateCollections: vi.fn(), updateTag: vi.fn() }))

const { createBulkTransferAction } = await import('@/lib/actions/transfers')

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('PAYOUT to a worker with no assigned etapy (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number
  const createdTransactions: number[] = []

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    // sort by id: parallel specs create and delete transient investments with the highest ids.
    const [investments, users, registers] = await Promise.all([
      payload.find({
        collection: 'investments',
        // A zakończona inwestycja refuses every write (EX-748), and the lowest ids in the fixture DB
        // are exactly that — so the arbitrary pick has to skip them or the whole spec writes nothing.
        where: { status: { not_equals: LOCKED_INVESTMENT_STATUS } },
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
      payload.find({ collection: 'users', limit: 1, sort: 'id', depth: 0, overrideAccess: true }),
      payload.find({
        collection: 'cash-registers',
        limit: 1,
        sort: 'id',
        depth: 0,
        overrideAccess: true,
      }),
    ])
    const investment = investments.docs[0]
    const user = users.docs[0]
    const register = registers.docs[0]
    if (!investment || !user || !register) throw new Error('missing DB fixtures for a PAYOUT')
    investmentId = Number(investment.id)
    workerId = Number(user.id)
    registerId = Number(register.id)
    authState.userId = workerId
  })

  afterAll(async () => {
    for (const id of createdTransactions) {
      await payload.delete({ collection: 'transactions', id, overrideAccess: true })
    }
  })

  it('persists the transaction even though the worker holds no etapy on the investment', async () => {
    const assigned = await db.execute(sql`
      SELECT COUNT(*)::int AS count FROM kosztorys_stages
      WHERE investment_id = ${investmentId} AND worker_id = ${workerId}
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
