import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { SELF_REMOVAL_MESSAGE } from '@/lib/constants/worker-lock'

// Every refusal is asserted on the rows, not the result: the pair is one transaction that commits a
// returned refusal, so a refusal decided after the first write would still leave a kasa trashed.
// The last-OWNER rule is covered in `account-removal.test.ts` — the restored dump always holds OWNERs.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { id: 1, role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({
    id: session.id,
    role: session.role,
    name: 'T',
    email: 't@t.pl',
  })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)
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
    const id = Number(
      (
        await payload.create({
          collection: 'users',
          data: { name: `Pracownik ${fixture}`, role, email, password: PASSWORD },
          context: { skipRevalidation: true },
        })
      ).id,
    )
    return { id, email, name: `Pracownik ${fixture}` }
  }

  const createRegister = async (ownerId: number, name: string) =>
    Number(
      (
        await payload.create({
          collection: 'cash-registers',
          data: { name, type: 'AUXILIARY', owner: ownerId },
          context: { skipRevalidation: true },
        })
      ).id,
    )

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
      VALUES (${MARKER}, 50, now(), 'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${registerId})
    `)

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/worker-trash')
    await purgeFixtureUsers(db)
  })

  beforeEach(() => {
    session.id = 1
    session.role = 'OWNER'
  })

  afterAll(async () => {
    await db.execute(sql`DELETE FROM transactions WHERE description = ${MARKER}`)
    await purgeFixtureUsers(db)
  })

  it('trashes an unused worker and his empty kasa under one instant, and ends his sessions', async () => {
    const worker = await createWorker()
    const registerId = await createRegister(worker.id, 'Kasa pracownika')
    await payload.login({ collection: 'users', data: { email: worker.email, password: PASSWORD } })

    expect(await actions.trashWorkerAction(worker.id)).toEqual({ success: true })

    const workerAt = await userTrashedAt(worker.id)
    expect(workerAt).not.toBeNull()
    expect(String(await registerTrashedAt(registerId))).toBe(String(workerAt))
    const { rows } = await db.execute(
      sql`SELECT count(*)::int AS n FROM users_sessions WHERE _parent_id = ${worker.id}`,
    )
    expect(Number(rows[0]?.n)).toBe(0)

    // Listed as the worker, with his kasa named — never as a kasa of its own.
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
      VALUES (${MARKER}, 50, now(), 'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${worker.id})
    `)

    expect((await actions.trashWorkerAction(worker.id)).success).toBe(false)
    expect(await userTrashedAt(worker.id)).toBeNull()
  })

  it('refuses the whole pair when one of his kasy is used, trashing nothing', async () => {
    const worker = await createWorker()
    const empty = await createRegister(worker.id, 'Kasa pusta')
    const used = await createRegister(worker.id, 'Kasa używana')
    await useRegister(used)

    const result = await actions.trashWorkerAction(worker.id)

    expect(result.success).toBe(false)
    expect(await userTrashedAt(worker.id)).toBeNull()
    expect(await registerTrashedAt(empty)).toBeNull()
    expect(await registerTrashedAt(used)).toBeNull()
  })

  it('refuses trashing your own account', async () => {
    const worker = await createWorker()
    session.id = worker.id

    expect(await actions.trashWorkerAction(worker.id)).toEqual({
      success: false,
      error: SELF_REMOVAL_MESSAGE,
    })
    expect(await userTrashedAt(worker.id)).toBeNull()
  })

  it('answers a MANAGER about an OWNER as missing', async () => {
    const owner = await createWorker('OWNER')
    session.role = 'MANAGER'

    const result = await actions.trashWorkerAction(owner.id)

    expect(result).toEqual({ success: false, error: 'Pracownik nie istnieje.' })
    expect(await userTrashedAt(owner.id)).toBeNull()
  })

  it('restores the worker with the kasy that went with him, not one trashed on its own', async () => {
    const worker = await createWorker()
    const withHim = await createRegister(worker.id, 'Kasa razem')
    const alone = await createRegister(worker.id, 'Kasa osobno')
    await db.execute(
      sql`UPDATE cash_registers SET trashed_at = now() - interval '1 day' WHERE id = ${alone}`,
    )

    expect((await actions.trashWorkerAction(worker.id)).success).toBe(true)
    expect(await actions.restoreWorkerAction(worker.id)).toEqual({ success: true })

    expect(await userTrashedAt(worker.id)).toBeNull()
    expect(await registerTrashedAt(withHim)).toBeNull()
    expect(await registerTrashedAt(alone)).not.toBeNull()
  })

  it('deletes forever only on the right name, kasy first and then the worker', async () => {
    const worker = await createWorker()
    const registerId = await createRegister(worker.id, 'Kasa do usunięcia')
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
