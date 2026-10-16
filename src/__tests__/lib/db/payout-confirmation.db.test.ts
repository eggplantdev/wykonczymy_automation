import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  acceptPayout,
  countPendingPayouts,
  countRejectedPayouts,
  listPayoutsToConfirm,
  listRejectedPayouts,
  rejectPayout,
} from '@/lib/db/payout-confirmation'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { createRegisterOwner } from '@/__tests__/helpers/transfer-fixtures'

vi.mock('server-only', () => ({}))
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return { ...actual, after: () => {} }
})

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
const MARKER = 'payout confirmation spec'
const CONTEXT = { skipRevalidation: true, skipSheetSync: true }

describe.skipIf(!ENV_READY)('the worker’s decision on a wypłata (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let worker: { ownerId: number; registerId: number }
  let stranger: { ownerId: number; registerId: number }

  async function bookPayout(label: string, workerId = worker.ownerId): Promise<number> {
    const created = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} ${label}`,
        type: 'PAYOUT',
        amount: 800,
        date: '2026-10-11T09:00:00.000Z',
        sourceRegister: worker.registerId,
        investment: investmentId,
        worker: workerId,
      },
      overrideAccess: true,
      context: CONTEXT,
    })
    return Number(created.id)
  }

  // Raw rather than through the action: the CANCELLATION row's age is what the window reads.
  async function cancel(transactionId: number, daysAgo: number): Promise<void> {
    await db.execute(sql`UPDATE transactions SET cancelled = true WHERE id = ${transactionId}`)
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, cancelled_transaction_id, created_at)
      VALUES (${`${MARKER} anulowanie`}, 800, now(), 'CANCELLATION', ${transactionId},
              now() - make_interval(days => ${daysAgo}))
    `)
  }

  async function stored(transactionId: number) {
    const { rows } = await db.execute(sql`
      SELECT payout_status, payout_decided_at, payout_rejection_reason
      FROM transactions WHERE id = ${transactionId}
    `)
    return {
      status: rows[0].payout_status as string | null,
      decidedAt:
        rows[0].payout_decided_at == null ? null : new Date(String(rows[0].payout_decided_at)),
      reason: rows[0].payout_rejection_reason as string | null,
    }
  }

  const cleanUp = () =>
    db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)

    await cleanUp()
    await purgeFixtureUsers(db)

    const ctx = { context: { skipRevalidation: true } }
    worker = await createRegisterOwner(
      payload,
      { name: 'Payout Worker', email: 'payout-worker@test.local', registerName: 'payout-worker' },
      ctx,
    )
    stranger = await createRegisterOwner(
      payload,
      {
        name: 'Payout Stranger',
        email: 'payout-stranger@test.local',
        registerName: 'payout-stranger',
      },
      ctx,
    )
    investmentId = await createTestInvestment(payload, 'payout-confirmation-investment')
  })

  afterAll(async () => {
    await cleanUp()
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    const owners = [worker?.ownerId, stranger?.ownerId].filter((id) => id !== undefined)
    for (const ownerId of owners) {
      await db.execute(sql`DELETE FROM cash_registers WHERE owner_id = ${ownerId}`)
      await db.execute(sql`DELETE FROM users WHERE id = ${ownerId}`)
    }
  })

  it('changes nothing when another worker accepts the wypłata', async () => {
    const id = await bookPayout('foreign')

    expect(await acceptPayout(db, { transactionId: id, workerId: stranger.ownerId })).toBe(false)
    expect((await stored(id)).status).toBe('pending')
  })

  it('changes nothing on a second rejection', async () => {
    const id = await bookPayout('rejected twice')
    await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 100 zł' })

    expect(
      await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Inny powód' }),
    ).toBe(false)
    expect((await stored(id)).reason).toBe('Brak 100 zł')
  })

  it('changes nothing on a cancelled wypłata', async () => {
    const id = await bookPayout('cancelled')
    await cancel(id, 0)

    expect(await acceptPayout(db, { transactionId: id, workerId: worker.ownerId })).toBe(false)
    expect(
      await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak' }),
    ).toBe(false)
    expect(await stored(id)).toEqual({ status: 'pending', decidedAt: null, reason: null })
  })

  it('accepts a rejected wypłata, keeping the reason and moving the date', async () => {
    const id = await bookPayout('changed mind')
    await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 100 zł' })
    await db.execute(sql`
      UPDATE transactions SET payout_decided_at = now() - interval '1 day' WHERE id = ${id}
    `)
    const rejectedAt = (await stored(id)).decidedAt

    expect(await acceptPayout(db, { transactionId: id, workerId: worker.ownerId })).toBe(true)
    const after = await stored(id)
    expect(after.status).toBe('accepted')
    expect(after.reason).toBe('Brak 100 zł')
    expect(after.decidedAt!.getTime()).toBeGreaterThan(rejectedAt!.getTime())
  })

  it('refuses to reject an accepted wypłata', async () => {
    const id = await bookPayout('accepted')
    await acceptPayout(db, { transactionId: id, workerId: worker.ownerId })

    expect(
      await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Jednak nie' }),
    ).toBe(false)
    expect(await stored(id)).toMatchObject({ status: 'accepted', reason: null })
  })

  it('lists what he still owes an answer, and a recent cancellation, but not an old one', async () => {
    const pending = await bookPayout('to confirm')
    const recentlyCancelled = await bookPayout('cancelled yesterday')
    await cancel(recentlyCancelled, 1)
    const longCancelled = await bookPayout('cancelled long ago')
    await cancel(longCancelled, 15)
    const accepted = await bookPayout('already accepted')
    await acceptPayout(db, { transactionId: accepted, workerId: worker.ownerId })
    const strangers = await bookPayout('someone else', stranger.ownerId)

    const listed = (await listPayoutsToConfirm(db, worker.ownerId)).map((row) => row.id)

    expect(listed).toEqual(expect.arrayContaining([pending, recentlyCancelled]))
    expect(listed).not.toContain(longCancelled)
    expect(listed).not.toContain(accepted)
    expect(listed).not.toContain(strangers)
  })

  it('drops a rejected wypłata from management’s queue once it is cancelled', async () => {
    const id = await bookPayout('rejected then cancelled')
    await rejectPayout(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 50 zł' })
    const before = await countRejectedPayouts(db)
    expect((await listRejectedPayouts(db)).map((row) => row.id)).toContain(id)

    await cancel(id, 0)

    expect(await countRejectedPayouts(db)).toBe(before - 1)
    expect((await listRejectedPayouts(db)).map((row) => row.id)).not.toContain(id)
  })

  it('counts for the badge only the wypłaty still waiting on his answer', async () => {
    await cleanUp()
    await bookPayout('badge one')
    await bookPayout('badge two')
    await cancel(await bookPayout('badge cancelled'), 0)
    await acceptPayout(db, {
      transactionId: await bookPayout('badge accepted'),
      workerId: worker.ownerId,
    })
    await rejectPayout(db, {
      transactionId: await bookPayout('badge rejected'),
      workerId: worker.ownerId,
      reason: 'Brak 100 zł',
    })
    await bookPayout('badge stranger', stranger.ownerId)

    expect(await countPendingPayouts(db, worker.ownerId)).toBe(2)
  })
})
