import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { purgeFixtureUsers } from '@/__tests__/helpers/purge-fixture-users'

// Both register FKs are ON DELETE SET NULL, so the delete this guards never errors on its own — it
// succeeds and the transaction stops naming the kasa it moved money out of.

const ENV_READY = Boolean(process.env.DB_POSTGRES_URL && process.env.PAYLOAD_SECRET)

describe.skipIf(!ENV_READY)('cash-registers beforeDelete guard (DB)', () => {
  let payload: Payload
  let db: Awaited<ReturnType<typeof getDb>>
  let registerId: number
  // Cleanup runs by id, never through the register: the second test deletes the kasa, and once
  // `source_register_id` is NULL `purgeFixtureUsers` can no longer see the row to remove it.
  const createdTransactionIds: number[] = []

  async function registerExists(): Promise<boolean> {
    const result = await db.execute(sql`SELECT 1 FROM cash_registers WHERE id = ${registerId}`)
    return result.rows.length > 0
  }

  async function insertTransfer(description: string, cancelled: boolean): Promise<number> {
    const inserted = await db.execute(sql`
      INSERT INTO transactions (description, amount, date, type, payment_method, source_register_id, cancelled)
      VALUES (${description}, 250, now(),
        'EMPLOYEE_EXPENSE'::enum_transactions_type, 'CASH', ${registerId}, ${cancelled})
      RETURNING id
    `)
    const id = Number((inserted.rows[0] as { id: number }).id)
    createdTransactionIds.push(id)
    return id
  }

  function deleteRegister() {
    return payload.delete({
      collection: 'cash-registers',
      id: registerId,
      overrideAccess: true,
      context: { skipRevalidation: true },
    })
  }

  beforeAll(async () => {
    const { getPayload } = await import('payload')
    const config = (await import('@payload-config')).default
    payload = await getPayload({ config })
    db = await getDb(payload)
    await purgeFixtureUsers(db)

    const owner = await payload.create({
      collection: 'users',
      data: {
        name: 'Właściciel Kasy',
        role: 'EMPLOYEE',
        email: 'registers-delete-guard@test.local',
        password: 'test-password-123',
      },
      context: { skipRevalidation: true },
    })

    const register = await payload.create({
      collection: 'cash-registers',
      data: { name: 'Kasa do usunięcia', type: 'AUXILIARY', owner: Number(owner.id) },
      context: { skipRevalidation: true },
    })
    registerId = Number(register.id)
  })

  afterAll(async () => {
    for (const id of createdTransactionIds) {
      await db.execute(sql`DELETE FROM transactions WHERE id = ${id}`)
    }
    await purgeFixtureUsers(db)
  })

  it('refuses to delete a register that still has live transactions', async () => {
    const transactionId = await insertTransfer('register-guard live employee expense', false)

    await expect(deleteRegister()).rejects.toThrow(/Nie można usunąć kasy/)
    expect(await registerExists()).toBe(true)

    await db.execute(sql`DELETE FROM transactions WHERE id = ${transactionId}`)
  })

  it('deletes a register whose only transactions are cancelled, orphaning them', async () => {
    const transactionId = await insertTransfer('register-guard cancelled employee expense', true)

    await deleteRegister()
    expect(await registerExists()).toBe(false)

    const transaction = await db.execute(
      sql`SELECT source_register_id FROM transactions WHERE id = ${transactionId}`,
    )
    expect(transaction.rows.length).toBe(1)
    expect(
      (transaction.rows[0] as { source_register_id: number | null }).source_register_id,
    ).toBeNull()
  })
})
