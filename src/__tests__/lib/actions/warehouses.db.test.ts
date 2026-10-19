import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { Payload } from 'payload'
import { sql } from '@payloadcms/db-postgres'
import { getDb } from '@/lib/db/get-db'
import { authState } from '@/__tests__/stubs/get-current-user-jwt'
import { ENV_READY, bootTestPayload } from '@/__tests__/helpers/payload'

const NAME = 'EX-758 Kwiatowa'

describe.skipIf(!ENV_READY)(
  'createWarehouseAction keeps the dictionary one row per place (DB)',
  () => {
    let payload: Payload
    let db: Awaited<ReturnType<typeof getDb>>
    let createWarehouseAction: typeof import('@/lib/actions/warehouses').createWarehouseAction

    const countRows = async () => {
      const rows = await db.execute(
        sql`SELECT id FROM warehouses WHERE lower(name) = ${NAME.toLowerCase()}`,
      )
      return rows.rows.length
    }

    const purge = async () => {
      await db.execute(sql`DELETE FROM warehouses WHERE lower(name) = ${NAME.toLowerCase()}`)
    }

    beforeAll(async () => {
      authState.role = 'ADMIN'
      payload = await bootTestPayload()
      db = await getDb(payload)
      ;({ createWarehouseAction } = await import('@/lib/actions/warehouses'))
    })

    beforeEach(purge)
    afterAll(purge)

    it('creates the warehouse when the name is free', async () => {
      const result = await createWarehouseAction(NAME)

      expect(result.success).toBe(true)
      expect(await countRows()).toBe(1)
    })

    it('refuses a name that differs only in case, and writes nothing', async () => {
      await createWarehouseAction(NAME)

      const result = await createWarehouseAction(NAME.toLowerCase())

      expect(result.success).toBe(false)
      expect(await countRows()).toBe(1)
    })
  },
)
