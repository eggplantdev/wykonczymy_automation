import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestRegister } from '@/__tests__/helpers/register'
import { CASH_REGISTER_TRASHED_MESSAGE } from '@/lib/constants/cash-register-lock'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

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
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    userId = await createTestUser(payload, {
      name: 'Domyślna Kasa',
      email: 'default-register-guard@test.local',
    })

    liveRegisterId = await createTestRegister(payload, userId, 'Kasa żywa')
    trashedRegisterId = await createTestRegister(payload, userId, 'Kasa w koszu')
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

  it('lets an edit through when the stored default is already trashed', async () => {
    await db.execute(
      sql`UPDATE users SET default_cash_register_id = ${trashedRegisterId} WHERE id = ${userId}`,
    )

    await setDefault(trashedRegisterId, 'Nowe Imię')
    const result = await db.execute(sql`SELECT name FROM users WHERE id = ${userId}`)
    expect((result.rows[0] as { name: string }).name).toBe('Nowe Imię')
  })
})
