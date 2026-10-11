import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// Risk #27, the booking half: a wypłata is born `pending` whichever path books it, and no edit — the
// Local API one every action writes on included — can move the worker's answer. Asserted on the
// STORED row: the hook's return value would say nothing about what Payload finally wrote.

vi.mock('server-only', () => ({}))
// The sheet-sync hook defers to after(), which needs a request scope and live Google credentials.
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'payout status default'
const CONTEXT = { skipRevalidation: true, skipSheetSync: true }

type PersistedT = { status: string | null; decidedAt: unknown; reason: string | null }

describe.skipIf(!ENV_READY)('a wypłata is born pending and only the worker moves it (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let workerId: number
  let registerId: number

  async function createRow(
    data: Partial<Transaction> & Pick<Transaction, 'type' | 'description'>,
  ): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        amount: 500,
        date: '2026-10-11T09:00:00.000Z',
        sourceRegister: registerId,
        investment: investmentId,
        ...data,
      },
      overrideAccess: true,
      context: CONTEXT,
    })
    return Number(created.id)
  }

  async function persisted(transactionId: number): Promise<PersistedT> {
    const result = await db.execute(sql`
      SELECT payout_status, payout_decided_at, payout_rejection_reason
      FROM transactions WHERE id = ${transactionId}
    `)
    const row = result.rows[0] ?? {}
    return {
      status: (row.payout_status as string | null) ?? null,
      decidedAt: row.payout_decided_at ?? null,
      reason: (row.payout_rejection_reason as string | null) ?? null,
    }
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
    await purgeFixtureUsers(db)

    const worker = await payload.create({
      collection: 'users',
      data: {
        name: 'Payout Default Worker',
        role: 'EMPLOYEE',
        email: 'payout-default-worker@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    workerId = Number(worker.id)

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'payout-default-register', owner: workerId, type: 'AUXILIARY' },
      context: { skipRevalidation: true },
    })
    registerId = Number(register.id)

    investmentId = await createTestInvestment(payload, 'payout-default-investment')
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
    if (workerId)
      await payload.delete({
        collection: 'users',
        id: workerId,
        context: { skipRevalidation: true },
      })
  })

  it('stamps pending on a new wypłata, even when the caller claims it is decided', async () => {
    const id = await createRow({
      description: `${MARKER} payout`,
      type: 'PAYOUT',
      worker: workerId,
      payoutStatus: 'accepted',
      payoutDecidedAt: '2026-10-11T10:00:00.000Z',
    })

    expect(await persisted(id)).toEqual({ status: 'pending', decidedAt: null, reason: null })
  })

  // A premia is the nearest neighbour — same worker, same investment — and is never put to him.
  it('leaves every other type without a status', async () => {
    const id = await createRow({
      description: `${MARKER} bonus`,
      type: 'BONUS',
      worker: workerId,
      payoutStatus: 'pending',
    })

    expect((await persisted(id)).status).toBeNull()
  })

  it('keeps the worker’s answer through a Local API edit that carries a status back', async () => {
    const id = await createRow({
      description: `${MARKER} decided`,
      type: 'PAYOUT',
      worker: workerId,
    })
    await db.execute(sql`
      UPDATE transactions
      SET payout_status = 'rejected', payout_decided_at = now(), payout_rejection_reason = 'Brak 100 zł'
      WHERE id = ${id}
    `)

    await payload.update({
      collection: 'transactions',
      id,
      data: {
        description: `${MARKER} decided, edited`,
        payoutStatus: 'pending',
        payoutDecidedAt: null,
        payoutRejectionReason: null,
      },
      context: CONTEXT,
    })

    const after = await persisted(id)
    expect(after.status).toBe('rejected')
    expect(after.decidedAt).not.toBeNull()
    expect(after.reason).toBe('Brak 100 zł')
  })

  it('refuses a decided status without its date at the database', async () => {
    const id = await createRow({
      description: `${MARKER} malformed`,
      type: 'PAYOUT',
      worker: workerId,
    })

    // Drizzle wraps the driver error, so the pg fields live on `cause`.
    const violatedConstraint = (statement: Promise<unknown>) =>
      statement.then(
        () => undefined,
        (error: { cause?: { constraint?: string } }) => error.cause?.constraint,
      )

    expect(
      await violatedConstraint(
        db.execute(sql`UPDATE transactions SET payout_status = 'accepted' WHERE id = ${id}`),
      ),
    ).toBe('transactions_payout_decided_at_iff_decided')
    expect(
      await violatedConstraint(
        db.execute(sql`
          UPDATE transactions SET payout_status = 'rejected', payout_decided_at = now() WHERE id = ${id}
        `),
      ),
    ).toBe('transactions_payout_rejected_has_reason')
  })
})
