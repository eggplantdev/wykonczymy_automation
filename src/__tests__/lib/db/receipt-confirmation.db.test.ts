import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { countRejectedReceipts } from '@/__tests__/helpers/stream-counts'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import {
  acceptReceipt,
  countPendingReceipts,
  listReceiptsToConfirm,
  listRejectedReceipts,
  pendingReceiptsOf,
  rejectReceipt,
} from '@/lib/db/receipt-confirmation'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { purgeFixtureUsers } from '@/__tests__/helpers/user'
import { createRegisterOwner } from '@/__tests__/helpers/register'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const MARKER = 'payout confirmation spec'
const CONTEXT = { skipRevalidation: true, skipSheetSync: true }

describe.skipIf(!ENV_READY)('the receiving worker’s decision on money handed to him (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let investmentId: number
  let worker: { ownerId: number; registerId: number }
  let stranger: { ownerId: number; registerId: number }
  let manager: { ownerId: number; registerId: number }

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

  async function bookMoneyIn(
    label: string,
    data:
      | { type: 'REGISTER_TRANSFER'; from: number; to: number }
      | { type: 'OTHER_DEPOSIT'; into: number },
  ): Promise<number> {
    const registers =
      data.type === 'REGISTER_TRANSFER'
        ? { sourceRegister: data.from, targetRegister: data.to }
        : { sourceRegister: data.into }
    const created = await payload.create({
      collection: 'transactions',
      data: {
        description: `${MARKER} ${label}`,
        type: data.type,
        amount: 300,
        date: '2026-10-20T09:00:00.000Z',
        ...registers,
      },
      overrideAccess: true,
      context: CONTEXT,
    })
    return Number(created.id)
  }

  const intoWorkerFromManager = (label: string) =>
    bookMoneyIn(label, {
      type: 'REGISTER_TRANSFER',
      from: manager.registerId,
      to: worker.registerId,
    })

  async function cancel(transactionId: number): Promise<void> {
    await db.execute(sql`UPDATE transactions SET cancelled = true WHERE id = ${transactionId}`)
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, cancelled_transaction_id)
      VALUES (${`${MARKER} anulowanie`}, 800, now(), 'CANCELLATION', ${transactionId})
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
    payload = await bootTestPayload()
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
    manager = await createRegisterOwner(
      payload,
      {
        name: 'Payout Manager',
        email: 'payout-manager@test.local',
        registerName: 'payout-manager',
        role: 'MANAGER',
      },
      ctx,
    )
    investmentId = await createTestInvestment(payload, 'receipt-confirmation-investment')
  })

  afterAll(async () => {
    await cleanUp()
    if (investmentId) await deleteTestInvestment(payload, investmentId)
    const owners = [worker?.ownerId, stranger?.ownerId, manager?.ownerId].filter(
      (id) => id !== undefined,
    )
    for (const ownerId of owners) {
      await db.execute(sql`DELETE FROM cash_registers WHERE owner_id = ${ownerId}`)
      await db.execute(sql`DELETE FROM users WHERE id = ${ownerId}`)
    }
  })

  it('changes nothing when another worker accepts the wypłata', async () => {
    const id = await bookPayout('foreign')

    expect(await acceptReceipt(db, { transactionId: id, workerId: stranger.ownerId })).toBe(false)
    expect((await stored(id)).status).toBe('pending')
  })

  it('lets only the receiving worker answer a transfer, never the sender or another worker', async () => {
    const id = await intoWorkerFromManager('transfer to worker')

    for (const workerId of [manager.ownerId, stranger.ownerId]) {
      expect(await acceptReceipt(db, { transactionId: id, workerId })).toBe(false)
      expect(await rejectReceipt(db, { transactionId: id, workerId, reason: 'Nie moje' })).toBe(
        false,
      )
    }
    expect((await stored(id)).status).toBe('pending')

    expect(await acceptReceipt(db, { transactionId: id, workerId: worker.ownerId })).toBe(true)
    expect((await stored(id)).status).toBe('accepted')
  })

  it('hands a transfer between two workers to the receiver, not the sender', async () => {
    const id = await bookMoneyIn('worker to worker', {
      type: 'REGISTER_TRANSFER',
      from: worker.registerId,
      to: stranger.registerId,
    })

    expect(await acceptReceipt(db, { transactionId: id, workerId: worker.ownerId })).toBe(false)
    expect(
      await rejectReceipt(db, {
        transactionId: id,
        workerId: stranger.ownerId,
        reason: 'Brak 50 zł',
      }),
    ).toBe(true)
    expect((await stored(id)).status).toBe('rejected')
  })

  it('lets the owner of the kasa answer a deposit into it, and shows it to management', async () => {
    const id = await bookMoneyIn('deposit', { type: 'OTHER_DEPOSIT', into: worker.registerId })

    expect(await acceptReceipt(db, { transactionId: id, workerId: stranger.ownerId })).toBe(false)
    expect(
      await rejectReceipt(db, {
        transactionId: id,
        workerId: worker.ownerId,
        reason: 'Brak 20 zł',
      }),
    ).toBe(true)

    const row = (await listRejectedReceipts(db)).find((receipt) => receipt.id === id)
    expect(row).toMatchObject({
      type: 'OTHER_DEPOSIT',
      recipientId: worker.ownerId,
      recipientName: 'Payout Worker',
      registerId: worker.registerId,
      registerName: 'payout-worker',
    })
  })

  it('names the receiving kasa, not the sending one, on a rejected transfer', async () => {
    const id = await intoWorkerFromManager('rejected transfer')
    await rejectReceipt(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 10 zł' })

    const row = (await listRejectedReceipts(db)).find((receipt) => receipt.id === id)
    expect(row).toMatchObject({
      type: 'REGISTER_TRANSFER',
      recipientId: worker.ownerId,
      registerId: worker.registerId,
    })
  })

  it('changes nothing on a second rejection', async () => {
    const id = await bookPayout('rejected twice')
    await rejectReceipt(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 100 zł' })

    expect(
      await rejectReceipt(db, {
        transactionId: id,
        workerId: worker.ownerId,
        reason: 'Inny powód',
      }),
    ).toBe(false)
    expect((await stored(id)).reason).toBe('Brak 100 zł')
  })

  it('changes nothing on a cancelled wypłata', async () => {
    const id = await bookPayout('cancelled')
    await cancel(id)

    expect(await acceptReceipt(db, { transactionId: id, workerId: worker.ownerId })).toBe(false)
    expect(
      await rejectReceipt(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak' }),
    ).toBe(false)
    expect(await stored(id)).toEqual({ status: 'pending', decidedAt: null, reason: null })
  })

  it('accepts a rejected wypłata, keeping the reason and moving the date', async () => {
    const id = await bookPayout('changed mind')
    await rejectReceipt(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 100 zł' })
    await db.execute(sql`
      UPDATE transactions SET payout_decided_at = now() - interval '1 day' WHERE id = ${id}
    `)
    const rejectedAt = (await stored(id)).decidedAt

    expect(await acceptReceipt(db, { transactionId: id, workerId: worker.ownerId })).toBe(true)
    const after = await stored(id)
    expect(after.status).toBe('accepted')
    expect(after.reason).toBe('Brak 100 zł')
    expect(after.decidedAt!.getTime()).toBeGreaterThan(rejectedAt!.getTime())
  })

  it('refuses to reject an accepted wypłata', async () => {
    const id = await bookPayout('accepted')
    await acceptReceipt(db, { transactionId: id, workerId: worker.ownerId })

    expect(
      await rejectReceipt(db, {
        transactionId: id,
        workerId: worker.ownerId,
        reason: 'Jednak nie',
      }),
    ).toBe(false)
    expect(await stored(id)).toMatchObject({ status: 'accepted', reason: null })
  })

  it('lists what he still owes an answer, but no cancelled wypłata', async () => {
    const pending = await bookPayout('to confirm')
    const rejected = await bookPayout('rejected')
    await rejectReceipt(db, {
      transactionId: rejected,
      workerId: worker.ownerId,
      reason: 'Brak 50 zł',
    })
    const cancelled = await bookPayout('cancelled')
    await cancel(cancelled)
    const accepted = await bookPayout('already accepted')
    await acceptReceipt(db, { transactionId: accepted, workerId: worker.ownerId })
    const strangers = await bookPayout('someone else', stranger.ownerId)
    const transfer = await intoWorkerFromManager('transfer to confirm')
    const deposit = await bookMoneyIn('deposit to confirm', {
      type: 'OTHER_DEPOSIT',
      into: worker.registerId,
    })
    const cancelledTransfer = await intoWorkerFromManager('cancelled transfer')
    await cancel(cancelledTransfer)

    const listed = (await listReceiptsToConfirm(db, worker.ownerId)).map((row) => row.id)

    expect(listed).toEqual(expect.arrayContaining([pending, rejected, transfer, deposit]))
    expect(listed).not.toContain(cancelledTransfer)
    expect(listed).not.toContain(cancelled)
    expect(listed).not.toContain(accepted)
    expect(listed).not.toContain(strangers)
  })

  it('drops a rejected wypłata from management’s queue once it is cancelled', async () => {
    const id = await bookPayout('rejected then cancelled')
    await rejectReceipt(db, { transactionId: id, workerId: worker.ownerId, reason: 'Brak 50 zł' })
    const before = await countRejectedReceipts(db)
    expect((await listRejectedReceipts(db)).map((row) => row.id)).toContain(id)

    await cancel(id)

    expect(await countRejectedReceipts(db)).toBe(before - 1)
    expect((await listRejectedReceipts(db)).map((row) => row.id)).not.toContain(id)
  })

  it('counts for the badge only the wypłaty still waiting on his answer', async () => {
    await cleanUp()
    await bookPayout('badge one')
    await bookPayout('badge two')
    await cancel(await bookPayout('badge cancelled'))
    await acceptReceipt(db, {
      transactionId: await bookPayout('badge accepted'),
      workerId: worker.ownerId,
    })
    await rejectReceipt(db, {
      transactionId: await bookPayout('badge rejected'),
      workerId: worker.ownerId,
      reason: 'Brak 100 zł',
    })
    await bookPayout('badge stranger', stranger.ownerId)
    await intoWorkerFromManager('badge transfer')
    await bookMoneyIn('badge deposit', { type: 'OTHER_DEPOSIT', into: worker.registerId })

    expect(await countPendingReceipts(db, worker.ownerId)).toBe(4)
  })

  it('looks up who to notify only for the rows still pending', async () => {
    const transfer = await intoWorkerFromManager('push transfer')
    const payout = await bookPayout('push payout', stranger.ownerId)
    const accepted = await intoWorkerFromManager('push accepted')
    await acceptReceipt(db, { transactionId: accepted, workerId: worker.ownerId })
    const unasked = await bookMoneyIn('push unasked', {
      type: 'REGISTER_TRANSFER',
      from: worker.registerId,
      to: manager.registerId,
    })

    const pending = await pendingReceiptsOf(db, [transfer, payout, accepted, unasked])
    expect(pending).toHaveLength(2)
    expect(pending).toEqual(
      expect.arrayContaining([
        { recipientId: worker.ownerId, amount: 300 },
        { recipientId: stranger.ownerId, amount: 800 },
      ]),
    )
    expect(await pendingReceiptsOf(db, [accepted, unasked])).toEqual([])
  })
})
