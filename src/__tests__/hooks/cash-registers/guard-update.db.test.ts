import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { createTestRegister } from '@/__tests__/helpers/register'
import {
  CASH_REGISTER_OWNER_LOCKED_MESSAGE,
  CASH_REGISTER_TRASHED_MESSAGE,
} from '@/lib/constants/cash-register-lock'
import { OWNER_TRASHED_RESTORE_MESSAGE, WORKER_TRASHED_MESSAGE } from '@/lib/constants/worker-lock'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'
import { createTestUser, purgeFixtureUsers } from '@/__tests__/helpers/user'

// Every assertion reads the row back: a refused update that still wrote something is the failure this
// guards, and a rejected promise alone would not show it.

describe.skipIf(!ENV_READY)('cash-registers update guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let ownerId: number
  let otherOwnerId: number

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

  beforeAll(async () => {
    payload = await bootTestPayload()
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    ownerId = await createTestUser(payload, { email: 'registers-update-guard@test.local' })
    otherOwnerId = await createTestUser(payload, {
      email: 'registers-update-guard-other@test.local',
    })
  })

  afterAll(async () => {
    await purgeFixtureUsers(db)
  })

  it('refuses an edit of a trashed kasa', async () => {
    const id = await createTestRegister(payload, ownerId, 'Kasa w koszu')
    await db.execute(sql`UPDATE cash_registers SET trashed_at = now() WHERE id = ${id}`)

    await expect(updateRegister(id, { name: 'Nowa nazwa' })).rejects.toThrow(
      CASH_REGISTER_TRASHED_MESSAGE,
    )
    expect((await readRow(id)).name).toBe('Kasa w koszu')
  })

  it('refuses an owner change on a kasa with live transactions', async () => {
    const id = await createTestRegister(payload, ownerId, 'Kasa używana')
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('owner-lock live expense', 50, now(),
        'OTHER'::enum_transactions_type, 'CASH', ${id})
    `)

    await expect(updateRegister(id, { owner: otherOwnerId })).rejects.toThrow(
      CASH_REGISTER_OWNER_LOCKED_MESSAGE,
    )
    expect(Number((await readRow(id)).owner_id)).toBe(ownerId)
  })

  it('lets a used kasa keep its owner through an ordinary edit', async () => {
    const id = await createTestRegister(payload, ownerId, 'Kasa używana, zmiana nazwy')
    await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id)
      VALUES ('owner-lock rename expense', 50, now(),
        'OTHER'::enum_transactions_type, 'CASH', ${id})
    `)

    await updateRegister(id, { name: 'Nowa nazwa', owner: ownerId })
    expect((await readRow(id)).name).toBe('Nowa nazwa')
  })

  it('ignores trashedAt on an access-checked update (a MANAGER REST PATCH)', async () => {
    const id = await createTestRegister(payload, ownerId, 'Kasa z REST')

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
    const id = await createTestRegister(payload, ownerId, 'Kasa pusta')

    await updateRegister(id, { owner: otherOwnerId })
    expect(Number((await readRow(id)).owner_id)).toBe(otherOwnerId)
  })

  describe('an owner in the kosz', () => {
    async function withOtherOwnerTrashed(run: () => Promise<void>) {
      await db.execute(sql`UPDATE users SET trashed_at = now() WHERE id = ${otherOwnerId}`)
      try {
        await run()
      } finally {
        await db.execute(sql`UPDATE users SET trashed_at = NULL WHERE id = ${otherOwnerId}`)
      }
    }

    it('refuses a new kasa for a trashed worker', async () => {
      await withOtherOwnerTrashed(async () => {
        await expect(createTestRegister(payload, otherOwnerId, 'Kasa dla kosza')).rejects.toThrow(
          WORKER_TRASHED_MESSAGE,
        )
      })
      const rows = await db.execute(
        sql`SELECT id FROM cash_registers WHERE owner_id = ${otherOwnerId} AND name = 'Kasa dla kosza'`,
      )
      expect(rows.rows).toEqual([])
    })

    it('refuses handing an unused kasa to a trashed worker', async () => {
      const id = await createTestRegister(payload, ownerId, 'Kasa pusta, właściciel w koszu')
      await withOtherOwnerTrashed(async () => {
        await expect(updateRegister(id, { owner: otherOwnerId })).rejects.toThrow(
          WORKER_TRASHED_MESSAGE,
        )
      })
      expect(Number((await readRow(id)).owner_id)).toBe(ownerId)
    })

    it('refuses restoring a kasa while its owner is in the kosz', async () => {
      const id = await createTestRegister(payload, otherOwnerId, 'Kasa pracownika w koszu')
      await db.execute(sql`UPDATE cash_registers SET trashed_at = now() WHERE id = ${id}`)
      await withOtherOwnerTrashed(async () => {
        await expect(updateRegister(id, { trashedAt: null })).rejects.toThrow(
          OWNER_TRASHED_RESTORE_MESSAGE,
        )
      })
      expect((await readRow(id)).trashed_at).not.toBeNull()
    })
  })
})
