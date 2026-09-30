import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'

// Asserted on persisted rows: a trash that reports success but never stamps `trashed_at`, or leaves
// a user's default pointing at the trashed kasa, reads identically at the action's return value. The
// session is mocked rather than `requireAuth`, so the role gate under test is the real one.

vi.mock('server-only', () => ({}))

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))
vi.mock('@/lib/cache/revalidate', () => import('@/__tests__/stubs/cache-revalidate'))

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('cash-register trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/cash-register-trash')
  let ownerId: number

  const createRegister = async (name: string, type: 'AUXILIARY' | 'MAIN' = 'AUXILIARY') =>
    Number(
      (
        await payload.create({
          collection: 'cash-registers',
          data: { name, type, owner: ownerId },
          context: { skipRevalidation: true },
        })
      ).id,
    )

  const trashedAt = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT trashed_at FROM cash_registers WHERE id = ${id}`)
    return rows[0]?.trashed_at ?? null
  }

  const exists = async (id: number) => {
    const { rows } = await db.execute(sql`SELECT 1 FROM cash_registers WHERE id = ${id}`)
    return rows.length > 0
  }

  const defaultOf = async (userId: number) => {
    const { rows } = await db.execute(
      sql`SELECT default_cash_register_id FROM users WHERE id = ${userId}`,
    )
    return rows[0]?.default_cash_register_id ?? null
  }

  const insertTransaction = async (registerId: number, cancelled: boolean) => {
    const { rows } = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id, cancelled)
      VALUES ('kosz-kas trash-actions', 50, now(), 'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH',
        ${registerId}, ${cancelled})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    actions = await import('@/lib/actions/cash-register-trash')
    await purgeFixtureUsers(db)

    ownerId = Number(
      (
        await payload.create({
          collection: 'users',
          data: {
            name: 'Kosz Kas',
            role: 'EMPLOYEE',
            email: 'kosz-kas-actions@test.local',
            password: 'test-password-123',
          },
          context: { skipRevalidation: true },
        })
      ).id,
    )
  })

  beforeEach(() => {
    session.role = 'OWNER'
    revalidateCollections.mockClear()
  })

  afterAll(async () => {
    await db.execute(sql`
      DELETE FROM transactions WHERE description = 'kosz-kas trash-actions'
    `)
    await purgeFixtureUsers(db)
  })

  it('lets a MANAGER trash, restore and delete an AUXILIARY kasa forever', async () => {
    const id = await createRegister('Kasa managera')
    session.role = 'MANAGER'

    expect((await actions.trashCashRegisterAction(id)).success).toBe(true)
    expect(await trashedAt(id)).not.toBeNull()

    expect((await actions.restoreCashRegisterAction(id)).success).toBe(true)
    expect(await trashedAt(id)).toBeNull()

    expect((await actions.trashCashRegisterAction(id)).success).toBe(true)
    expect((await actions.deleteCashRegisterForeverAction(id)).success).toBe(true)
    expect(await exists(id)).toBe(false)
  })

  it('expires the kasy and users readers, and the transfers too on a delete', async () => {
    const id = await createRegister('Kasa tagi')

    await actions.trashCashRegisterAction(id)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual(['cashRegisters', 'users'])

    await actions.deleteCashRegisterForeverAction(id)
    expect(revalidateCollections.mock.calls.at(-1)?.[0]).toEqual([
      'cashRegisters',
      'users',
      'transfers',
    ])
  })

  // A MANAGER never sees MAIN, so the kasa answers as missing — and stays untouched.
  it('refuses a MANAGER every action on a MAIN kasa', async () => {
    const live = await createRegister('Główna żywa', 'MAIN')
    const trashed = await createRegister('Główna w koszu', 'MAIN')
    await actions.trashCashRegisterAction(trashed)
    session.role = 'MANAGER'

    expect(await actions.trashCashRegisterAction(live)).toEqual({
      success: false,
      error: 'Kasa nie istnieje.',
    })
    expect((await actions.restoreCashRegisterAction(trashed)).success).toBe(false)
    expect((await actions.deleteCashRegisterForeverAction(trashed)).success).toBe(false)

    expect(await trashedAt(live)).toBeNull()
    expect(await trashedAt(trashed)).not.toBeNull()
  })

  it('refuses an EMPLOYEE every action', async () => {
    const live = await createRegister('Pracownik żywa')
    const trashed = await createRegister('Pracownik w koszu')
    await actions.trashCashRegisterAction(trashed)
    session.role = 'EMPLOYEE'

    expect((await actions.trashCashRegisterAction(live)).success).toBe(false)
    expect((await actions.restoreCashRegisterAction(trashed)).success).toBe(false)
    expect((await actions.deleteCashRegisterForeverAction(trashed)).success).toBe(false)

    expect(await trashedAt(live)).toBeNull()
    expect(await trashedAt(trashed)).not.toBeNull()
  })

  it('refuses to trash a kasa with a live transaction, naming the count', async () => {
    const id = await createRegister('Kasa używana')
    await insertTransaction(id, false)

    const result = await actions.trashCashRegisterAction(id)

    expect(result).toEqual({ success: false, error: expect.stringContaining('transakcje: 1') })
    expect(await trashedAt(id)).toBeNull()
  })

  it('trashes a kasa whose only transaction is cancelled, and a delete strips it off that row', async () => {
    const id = await createRegister('Kasa z anulowaną')
    const transactionId = await insertTransaction(id, true)

    expect((await actions.trashCashRegisterAction(id)).success).toBe(true)
    expect((await actions.deleteCashRegisterForeverAction(id)).success).toBe(true)

    const { rows } = await db.execute(
      sql`SELECT source_register_id FROM transactions WHERE id = ${transactionId}`,
    )
    expect(rows[0].source_register_id).toBeNull()
  })

  it('clears the default on trash, and restore does not bring it back', async () => {
    const id = await createRegister('Kasa domyślna')
    await db.execute(sql`UPDATE users SET default_cash_register_id = ${id} WHERE id = ${ownerId}`)

    await actions.trashCashRegisterAction(id)
    expect(await defaultOf(ownerId)).toBeNull()

    await actions.restoreCashRegisterAction(id)
    expect(await trashedAt(id)).toBeNull()
    expect(await defaultOf(ownerId)).toBeNull()
  })

  it('refuses to delete forever a kasa that is not in the trash', async () => {
    const id = await createRegister('Kasa poza koszem')

    expect(await actions.deleteCashRegisterForeverAction(id)).toEqual({
      success: false,
      error: 'Najpierw przenieś kasę do kosza.',
    })
    expect(await exists(id)).toBe(true)
  })
})
