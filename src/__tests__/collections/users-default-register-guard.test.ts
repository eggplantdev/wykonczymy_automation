import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-vercel-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'
import { CASH_REGISTER_TRASHED_MESSAGE } from '@/lib/constants/trash'

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('users default-kasa guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let userId: number
  let liveRegisterId: number
  let trashedRegisterId: number

  function setDefault(defaultCashRegister: number, name?: string) {
    return payload.update({
      collection: 'users',
      id: userId,
      data: { defaultCashRegister, ...(name ? { name } : {}) },
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  }

  async function readDefault(): Promise<number | null> {
    const result = await db.execute(
      sql`SELECT default_cash_register_id FROM users WHERE id = ${userId}`,
    )
    const value = (result.rows[0] as { default_cash_register_id: number | null })
      .default_cash_register_id
    return value === null ? null : Number(value)
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const user = await payload.create({
      collection: 'users',
      data: {
        name: 'Domyślna Kasa',
        role: 'EMPLOYEE',
        email: 'default-register-guard@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })
    userId = Number(user.id)

    const createRegister = async (name: string) =>
      Number(
        (
          await payload.create({
            collection: 'cash-registers',
            data: { name, type: 'AUXILIARY', owner: userId },
            context: { skipRevalidation: true },
          })
        ).id,
      )
    liveRegisterId = await createRegister('Kasa żywa')
    trashedRegisterId = await createRegister('Kasa w koszu')
  })

  afterAll(async () => {
    await db.execute(sql`UPDATE users SET default_cash_register_id = NULL WHERE id = ${userId}`)
    await purgeFixtureUsers(db)
  })

  it('refuses a trashed kasa as the new default', async () => {
    await db.execute(
      sql`UPDATE cash_registers SET trashed_at = now() WHERE id = ${trashedRegisterId}`,
    )

    await expect(setDefault(trashedRegisterId)).rejects.toThrow(CASH_REGISTER_TRASHED_MESSAGE)
    expect(await readDefault()).toBeNull()
  })

  it('accepts a live kasa as the default', async () => {
    await setDefault(liveRegisterId)
    expect(await readDefault()).toBe(liveRegisterId)
  })

  // The shape only a raw write can produce — the guard must not freeze the user's other fields over it.
  it('lets an edit through when the stored default is already trashed', async () => {
    await db.execute(
      sql`UPDATE users SET default_cash_register_id = ${trashedRegisterId} WHERE id = ${userId}`,
    )

    await setDefault(trashedRegisterId, 'Nowe Imię')
    const result = await db.execute(sql`SELECT name FROM users WHERE id = ${userId}`)
    expect((result.rows[0] as { name: string }).name).toBe('Nowe Imię')
  })
})
