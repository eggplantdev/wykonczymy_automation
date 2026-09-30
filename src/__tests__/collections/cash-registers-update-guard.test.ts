import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import {
  CASH_REGISTER_OWNER_LOCKED_MESSAGE,
  CASH_REGISTER_TRASHED_MESSAGE,
} from '@/lib/constants/cash-register-lock'

// Every assertion reads the row back: a refused update that still wrote something is the failure this
// guards, and a rejected promise alone would not show it.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('cash-registers update guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let otherOwnerId: number

  async function createRegister(name: string): Promise<number> {
    const register = await payload.create({
      collection: 'cash-registers',
      data: { name, type: 'AUXILIARY', owner: ownerId },
      context: { skipRevalidation: true },
    })
    return Number(register.id)
  }

  function updateRegister(id: number, data: Record<string, unknown>) {
    return payload.update({
      collection: 'cash-registers',
      id,
      data,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  }

  async function readRow(id: number) {
    const result = await db.execute(
      sql`SELECT name, owner_id, trashed_at FROM cash_registers WHERE id = ${id}`,
    )
    return result.rows[0] as { name: string; owner_id: number; trashed_at: string | null }
  }

  async function createUser(email: string): Promise<number> {
    const user = await payload.create({
      collection: 'users',
      data: { name: email, role: 'EMPLOYEE', email, password: 'test-password-123' },
      context: { skipRevalidation: true },
    })
    return Number(user.id)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    ownerId = await createUser('registers-update-guard@test.local')
    otherOwnerId = await createUser('registers-update-guard-other@test.local')
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('refuses an edit of a trashed kasa', async () => {
    const id = await createRegister('Kasa w koszu')
    await db.execute(sql`UPDATE cash_registers SET trashed_at = now() WHERE id = ${id}`)

    await expect(updateRegister(id, { name: 'Nowa nazwa' })).rejects.toThrow(
      CASH_REGISTER_TRASHED_MESSAGE,
    )
    expect((await readRow(id)).name).toBe('Kasa w koszu')
  })

  it('lets a trashed kasa be restored', async () => {
    const id = await createRegister('Kasa do przywrócenia')
    await db.execute(sql`UPDATE cash_registers SET trashed_at = now() WHERE id = ${id}`)

    await updateRegister(id, { trashedAt: null })
    expect((await readRow(id)).trashed_at).toBeNull()
  })

  it('refuses an owner change on a kasa with live transactions', async () => {
    const id = await createRegister('Kasa używana')
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('owner-lock live expense', 50, now(),
        'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${id})
    `)

    await expect(updateRegister(id, { owner: otherOwnerId })).rejects.toThrow(
      CASH_REGISTER_OWNER_LOCKED_MESSAGE,
    )
    expect(Number((await readRow(id)).owner_id)).toBe(ownerId)
  })

  it('lets a used kasa keep its owner through an ordinary edit', async () => {
    const id = await createRegister('Kasa używana, zmiana nazwy')
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('owner-lock rename expense', 50, now(),
        'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${id})
    `)

    await updateRegister(id, { name: 'Nowa nazwa', owner: ownerId })
    expect((await readRow(id)).name).toBe('Nowa nazwa')
  })

  it('ignores trashedAt on an access-checked update (a MANAGER REST PATCH)', async () => {
    const id = await createRegister('Kasa z REST')

    await payload.update({
      collection: 'cash-registers',
      id,
      data: { trashedAt: new Date().toISOString() },
      overrideAccess: false,
      user: { id: ownerId, role: 'MANAGER', collection: 'users' } as never,
      context: { skipRevalidation: true },
    })
    expect((await readRow(id)).trashed_at).toBeNull()
  })

  it('lets the owner of an unused kasa change', async () => {
    const id = await createRegister('Kasa pusta')

    await updateRegister(id, { owner: otherOwnerId })
    expect(Number((await readRow(id)).owner_id)).toBe(otherOwnerId)
  })
})
