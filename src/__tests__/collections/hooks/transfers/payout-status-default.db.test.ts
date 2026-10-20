import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import type { Transaction } from '@/payload-types'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestInvestment, deleteTestInvestment } from '@/__tests__/helpers/investment'
import { createTestRegister } from '@/__tests__/helpers/register'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

const MARKER = 'payout status default'
const CONTEXT = { skipRevalidation: true, skipSheetSync: true }

type PersistedT = { status: string | null; decidedAt: unknown; reason: string | null }

describe.skipIf(!ENV_READY)(
  'money handed to a worker is born pending and only he moves it (DB)',
  () => {
    let payload: Payload
    let db: Awaited<ReturnType<typeof getDb>>
    let investmentId: number
    let workerId: number
    let registerId: number
    let secondWorkerRegisterId: number
    let otherWorkerRegisterId: number
    let managerRegisterId: number

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
      payload = await bootTestPayload()
      db = await getDb(payload)

      await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
      await purgeFixtureUsers(db)

      workerId = await createTestUser(payload, {
        name: 'Payout Default Worker',
        email: 'payout-default-worker@test.local',
      })

      registerId = await createTestRegister(payload, workerId, 'payout-default-register')
      secondWorkerRegisterId = await createTestRegister(payload, workerId, 'payout-default-second')

      const otherWorkerId = await createTestUser(payload, {
        name: 'Payout Default Other Worker',
        email: 'payout-default-other@test.local',
      })
      otherWorkerRegisterId = await createTestRegister(
        payload,
        otherWorkerId,
        'payout-default-other',
      )

      const managerId = await createTestUser(payload, {
        name: 'Payout Default Manager',
        email: 'payout-default-manager@test.local',
        role: 'MANAGER',
      })
      managerRegisterId = await createTestRegister(payload, managerId, 'payout-default-manager')

      investmentId = await createTestInvestment(payload, 'payout-default-investment')
    })

    afterAll(async () => {
      await db.execute(sql`DELETE FROM transactions WHERE description LIKE ${`${MARKER}%`}`)
      if (investmentId) await deleteTestInvestment(payload, investmentId)
      await purgeFixtureUsers(db)
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

    it.each([
      ['manager → worker', () => managerRegisterId, () => registerId, 'pending'],
      ['worker → another worker', () => registerId, () => otherWorkerRegisterId, 'pending'],
      ['worker → manager', () => registerId, () => managerRegisterId, null],
      ['between two kasy of the same worker', () => registerId, () => secondWorkerRegisterId, null],
    ])('a transfer %s is stamped %s', async (label, source, target, expected) => {
      const id = await createRow({
        description: `${MARKER} transfer ${label}`,
        type: 'REGISTER_TRANSFER',
        sourceRegister: source(),
        targetRegister: target(),
        investment: null,
      })

      expect((await persisted(id)).status).toBe(expected)
    })

    it.each(['INVESTOR_DEPOSIT', 'COMPANY_FUNDING', 'OTHER_DEPOSIT'] as const)(
      'stamps pending on a %s into a worker’s kasa, and nothing into a manager’s',
      async (type) => {
        const data = { type, paymentMethod: 'CASH' as const, vatPlane: 'NET' as const }
        const intoWorker = await createRow({ description: `${MARKER} ${type} worker`, ...data })
        const intoManager = await createRow({
          description: `${MARKER} ${type} manager`,
          ...data,
          sourceRegister: managerRegisterId,
        })

        expect((await persisted(intoWorker)).status).toBe('pending')
        expect((await persisted(intoManager)).status).toBeNull()
      },
    )

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
  },
)
