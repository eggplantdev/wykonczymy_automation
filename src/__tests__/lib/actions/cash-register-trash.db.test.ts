import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { revalidateCollections } from '@/__tests__/stubs/cache-revalidate'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser } from '@/__tests__/helpers/user'
import { createTestRegister } from '@/__tests__/helpers/transfer-fixtures'
import { describeTrashContract } from '@/__tests__/helpers/trash-contract'

// The session is mocked rather than `requireAuth`, so the role gate under test is the real one.

const { session } = vi.hoisted(() => ({ session: { role: 'OWNER' } }))
vi.mock('@/lib/auth/get-current-user-jwt', () => ({
  getCurrentUserJwt: vi.fn(async () => ({ id: 1, role: session.role, name: 'T', email: 't@t.pl' })),
}))

describe.skipIf(!ENV_READY)('cash-register trash actions (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let actions: typeof import('@/lib/actions/cash-register-trash')
  let ownerId: number

  const createRegister = (name: string, type: 'AUXILIARY' | 'MAIN' = 'AUXILIARY') =>
    createTestRegister(payload, ownerId, name, { type })

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
      VALUES ('kosz-kas trash-actions', 50, now(), 'OTHER'::enum_transactions_type, 'CASH',
        ${registerId}, ${cancelled})
      RETURNING id
    `)
    return Number(rows[0].id)
  }

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    actions = await import('@/lib/actions/cash-register-trash')
    await purgeFixtureUsers(db)

    ownerId = await createTestUser(payload, {
      name: 'Kosz Kas',
      email: 'kosz-kas-actions@test.local',
    })
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

  describeTrashContract({
    table: 'cash_registers',
    nameColumn: 'name',
    prefix: 'kosz-kas kontrakt',
    create: async (contractPayload, name) => ({
      id: await createTestRegister(contractPayload, ownerId, name),
    }),
    addChild: (_contractPayload, registerId) => insertTransaction(registerId, true),
    childTable: 'transactions',
    childForeignKey: 'source_register_id',
    loadActions: async () => {
      const trashActions = await import('@/lib/actions/cash-register-trash')
      return {
        trash: trashActions.trashCashRegisterAction,
        restore: trashActions.restoreCashRegisterAction,
        deleteForever: trashActions.deleteCashRegisterForeverAction,
      }
    },
    setRole: (role) => {
      session.role = role
    },
    missingError: 'Kasa nie istnieje.',
    notInTrashError: 'Najpierw przenieś kasę do kosza.',
    revalidated: {
      trash: ['cashRegisters', 'users'],
      deleteForever: ['cashRegisters', 'users', 'transfers'],
    },
  })

  it('refuses a delete forever whose typed name does not match', async () => {
    const id = await createRegister('Kasa do potwierdzenia')
    await actions.trashCashRegisterAction(id)

    for (const typed of ['', 'Kasa do potwierdzeni']) {
      expect(await actions.deleteCashRegisterForeverAction(id, typed)).toEqual({
        success: false,
        error: 'Wpisana nazwa się nie zgadza.',
      })
    }
    expect(await exists(id)).toBe(true)

    expect(
      (await actions.deleteCashRegisterForeverAction(id, ' Kasa do potwierdzenia ')).success,
    ).toBe(true)
    expect(await exists(id)).toBe(false)
  })

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
    expect((await actions.deleteCashRegisterForeverAction(trashed, 'Główna w koszu')).success).toBe(
      false,
    )

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
    expect(
      (await actions.deleteCashRegisterForeverAction(trashed, 'Pracownik w koszu')).success,
    ).toBe(false)

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
    expect((await actions.deleteCashRegisterForeverAction(id, 'Kasa z anulowaną')).success).toBe(
      true,
    )

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
})
