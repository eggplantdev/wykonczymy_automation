import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestRegister } from '@/__tests__/helpers/register'
import { SELF_REMOVAL_MESSAGE } from '@/lib/constants/worker-lock'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'
import { trashDaysAgo } from '@/__tests__/helpers/investment'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'

// Every refusal is asserted on the rows, not the result: the pair is one transaction that commits a
// returned refusal, so a refusal decided after the first write would still leave a kasa trashed.

const PASSWORD = 'test-password-123'
const MARKER = 'kosz-pracownikow actions'

describe.skipIf(!ENV_READY)('worker trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/worker-trash')
  let fixture = 0

  const createWorker = async (role: 'EMPLOYEE' | 'OWNER' = 'EMPLOYEE') => {
    fixture += 1
    const email = `kosz-pracownikow-${fixture}@test.local`
    const name = `Pracownik ${fixture}`
    const id = await createTestUser(payload, { name, email, role, password: PASSWORD })
    return { id, email, name }
  }

  const userTrashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM users WHERE id = ${id}`)
    return (rows[0]?.trashed_at as string | null) ?? null
  }

  const registerTrashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM cash_registers WHERE id = ${id}`)
    return (rows[0]?.trashed_at as string | null) ?? null
  }

  const exists = async (table: 'users' | 'cash_registers', id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM ${sql.raw(table)} WHERE id = ${id}`)
    return rows.length > 0
  }

  const useRegister = (registerId: number) =>
    db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES (${MARKER}, 50, now(), 'OTHER'::enum_transactions_type, 'CASH', ${registerId})
    `)

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/worker-trash')
    await purgeFixtureUsers(db)
  })

  beforeEach(() => {
    authState.userId = 1
    authState.role = 'OWNER'
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = ${MARKER}`)
    await purgeFixtureUsers(db)
  })

  it('trashes an unused worker and his empty kasa under one instant, and ends his sessions and pushes', async () => {
    const worker = await createWorker()
    const registerId = await createTestRegister(payload, worker.id, 'Kasa pracownika')
    await payload.login({ collection: 'users', data: { email: worker.email, password: PASSWORD } })
    const { upsertPushSubscription } = await import('@/lib/db/push-subscriptions')
    await upsertPushSubscription(db, worker.id, {
      endpoint: 'https://push.test.local/worker-trash',
      p256dh: 'p256dh',
      auth: 'auth',
      userAgent: undefined,
    })

    expect(await actions.trashWorkerAction(worker.id)).toEqual({ success: true })

    const workerAt = await userTrashedAt(worker.id)
    expect(workerAt).not.toBeNull()
    expect(String(await registerTrashedAt(registerId))).toBe(String(workerAt))
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${worker.id}`,
    )
    expect(Number(rows[0]?.n)).toBe(0)
    const { rows: devices } = await db.execute(
      sql`SELECT count(*)::int AS n FROM push_subscriptions WHERE user_id = ${worker.id}`,
    )
    expect(Number(devices[0]?.n)).toBe(0)

    const { fetchTrashedWorkers } = await import('@/lib/db/worker-trash')
    const { fetchTrashedCashRegisters } = await import('@/lib/db/cash-register-trash')
    expect(
      (await fetchTrashedWorkers(db)).find((row) => row.id === worker.id)?.registerNames,
    ).toEqual(['Kasa pracownika'])
    expect((await fetchTrashedCashRegisters(db)).map((row) => row.id)).not.toContain(registerId)
  })

  it('refuses a worker named on a live transaction', async () => {
    const worker = await createWorker()
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, worker_id)
      VALUES (${MARKER}, 50, now(), 'PAYOUT'::enum_transactions_type, 'CASH', ${worker.id})
    `)

    expect((await actions.trashWorkerAction(worker.id)).success).toBe(false)
    expect(await userTrashedAt(worker.id)).toBeNull()
  })

  it('refuses the whole pair when one of his kasy is used, trashing nothing', async () => {
    const worker = await createWorker()
    const empty = await createTestRegister(payload, worker.id, 'Kasa pusta')
    const used = await createTestRegister(payload, worker.id, 'Kasa używana')
    await useRegister(used)

    const result = await actions.trashWorkerAction(worker.id)

    expect(result.success).toBe(false)
    expect(await userTrashedAt(worker.id)).toBeNull()
    expect(await registerTrashedAt(empty)).toBeNull()
    expect(await registerTrashedAt(used)).toBeNull()
  })

  it('refuses trashing your own account', async () => {
    const worker = await createWorker()
    authState.userId = worker.id

    expect(await actions.trashWorkerAction(worker.id)).toEqual({
      success: false,
      error: SELF_REMOVAL_MESSAGE,
    })
    expect(await userTrashedAt(worker.id)).toBeNull()
  })

  it('answers a MANAGER about an OWNER as missing', async () => {
    const owner = await createWorker('OWNER')
    authState.role = 'MANAGER'

    const result = await actions.trashWorkerAction(owner.id)

    expect(result).toEqual({ success: false, error: 'Pracownik nie istnieje.' })
    expect(await userTrashedAt(owner.id)).toBeNull()
  })

  it('restores the worker with the kasy that went with him, not one trashed on its own', async () => {
    const worker = await createWorker()
    const withHim = await createTestRegister(payload, worker.id, 'Kasa razem')
    const alone = await createTestRegister(payload, worker.id, 'Kasa osobno')
    await trashDaysAgo(db, alone, 1, 'cash_registers')

    expect((await actions.trashWorkerAction(worker.id)).success).toBe(true)
    expect(await actions.restoreWorkerAction(worker.id)).toEqual({ success: true })

    expect(await userTrashedAt(worker.id)).toBeNull()
    expect(await registerTrashedAt(withHim)).toBeNull()
    expect(await registerTrashedAt(alone)).not.toBeNull()
  })

  it('deletes forever only on the right name, kasy first and then the worker', async () => {
    const worker = await createWorker()
    const registerId = await createTestRegister(payload, worker.id, 'Kasa do usunięcia')
    await actions.trashWorkerAction(worker.id)

    expect((await actions.deleteWorkerForeverAction(worker.id, 'Ktoś inny')).success).toBe(false)
    expect(await exists('users', worker.id)).toBe(true)

    expect(await actions.deleteWorkerForeverAction(worker.id, worker.name)).toEqual({
      success: true,
    })
    expect(await exists('cash_registers', registerId)).toBe(false)
    expect(await exists('users', worker.id)).toBe(false)
  })

  it('refuses deleting a worker who is not in the trash', async () => {
    const worker = await createWorker()

    expect((await actions.deleteWorkerForeverAction(worker.id, worker.name)).success).toBe(false)
    expect(await exists('users', worker.id)).toBe(true)
  })
})
